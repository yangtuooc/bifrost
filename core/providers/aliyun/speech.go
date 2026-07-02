package aliyun

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

type AliyunSpeechRequest struct {
	Model      string                 `json:"model"`
	Input      AliyunSpeechInput      `json:"input"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

func (r *AliyunSpeechRequest) GetExtraParams() map[string]interface{} {
	return r.Parameters
}

type AliyunSpeechInput struct {
	Text         string `json:"text"`
	Voice        string `json:"voice"`
	LanguageType string `json:"language_type,omitempty"`
}

type AliyunSpeechResponse struct {
	StatusCode int                 `json:"status_code,omitempty"`
	RequestID  string              `json:"request_id,omitempty"`
	Code       string              `json:"code,omitempty"`
	Message    string              `json:"message,omitempty"`
	Output     AliyunSpeechOutput  `json:"output,omitempty"`
	Usage      AliyunSpeechUsage   `json:"usage,omitempty"`
	Error      *schemas.ErrorField `json:"error,omitempty"`
}

type AliyunSpeechOutput struct {
	Text         *string           `json:"text,omitempty"`
	Choices      interface{}       `json:"choices,omitempty"`
	FinishReason string            `json:"finish_reason,omitempty"`
	Audio        AliyunSpeechAudio `json:"audio,omitempty"`
}

type AliyunSpeechAudio struct {
	Data      string `json:"data,omitempty"`
	URL       string `json:"url,omitempty"`
	ID        string `json:"id,omitempty"`
	ExpiresAt int64  `json:"expires_at,omitempty"`
}

type AliyunSpeechUsage struct {
	InputTokens         int                                   `json:"input_tokens,omitempty"`
	OutputTokens        int                                   `json:"output_tokens,omitempty"`
	TotalTokens         int                                   `json:"total_tokens,omitempty"`
	InputTokenDetails   *schemas.SpeechUsageInputTokenDetails `json:"input_tokens_details,omitempty"`
	OutputTokensDetails *schemas.SpeechUsageInputTokenDetails `json:"output_tokens_details,omitempty"`
}

func ToAliyunSpeechRequest(request *schemas.BifrostSpeechRequest) (*AliyunSpeechRequest, error) {
	if request == nil || request.Input == nil || strings.TrimSpace(request.Input.Input) == "" {
		return nil, fmt.Errorf("speech input text is required")
	}
	if request.Params == nil || request.Params.VoiceConfig == nil || request.Params.VoiceConfig.Voice == nil || strings.TrimSpace(*request.Params.VoiceConfig.Voice) == "" {
		return nil, fmt.Errorf("speech voice is required")
	}

	req := &AliyunSpeechRequest{
		Model: request.Model,
		Input: AliyunSpeechInput{
			Text:  request.Input.Input,
			Voice: *request.Params.VoiceConfig.Voice,
		},
	}
	if request.Params.LanguageCode != nil {
		req.Input.LanguageType = *request.Params.LanguageCode
	}

	params := map[string]interface{}{}
	if request.Params.Instructions != "" {
		params["instructions"] = request.Params.Instructions
	}
	if request.Params.Speed != nil {
		params["speed"] = *request.Params.Speed
	}
	for key, value := range request.Params.ExtraParams {
		switch key {
		case "language_type":
			if languageType, ok := value.(string); ok {
				req.Input.LanguageType = languageType
				continue
			}
		case "voice":
			if voice, ok := value.(string); ok && strings.TrimSpace(voice) != "" {
				req.Input.Voice = voice
				continue
			}
		}
		params[key] = value
	}
	if len(params) > 0 {
		req.Parameters = params
	}
	return req, nil
}

func (provider *AliyunProvider) handleSpeech(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostSpeechRequest) (*schemas.BifrostSpeechResponse, *schemas.BifrostError) {
	jsonData, bifrostErr := providerUtils.CheckContextAndGetRequestBody(
		ctx,
		request,
		func() (providerUtils.RequestBodyWithExtraParams, error) {
			return ToAliyunSpeechRequest(request)
		})
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	sendBackRawRequest := providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest)
	sendBackRawResponse := providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)
	responseBody, latency, providerHeaders, bifrostErr := provider.doAliyunJSONRequest(ctx, http.MethodPost, provider.buildNativeURL(ctx, aliyunImageGenerationPath), key, jsonData, nil)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, responseBody, sendBackRawRequest, sendBackRawResponse)
	}

	var aliyunResp AliyunSpeechResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(responseBody, &aliyunResp, jsonData, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if bodyErr := aliyunResp.bifrostError(); bodyErr != nil {
		return nil, providerUtils.EnrichError(ctx, bodyErr, jsonData, responseBody, sendBackRawRequest, sendBackRawResponse)
	}

	response, bifrostErr := provider.aliyunSpeechResponseToBifrost(ctx, &aliyunResp, request)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, responseBody, sendBackRawRequest, sendBackRawResponse)
	}
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	if sendBackRawRequest {
		response.ExtraFields.RawRequest = rawRequest
	}
	if sendBackRawResponse {
		response.ExtraFields.RawResponse = rawResponse
	}
	return response, nil
}

func (provider *AliyunProvider) handleSpeechStream(ctx *schemas.BifrostContext, postHookRunner schemas.PostHookRunner, postHookSpanFinalizer func(context.Context), key schemas.Key, request *schemas.BifrostSpeechRequest) (chan *schemas.BifrostStreamChunk, *schemas.BifrostError) {
	providerUtils.SetStreamIdleTimeoutIfEmpty(ctx, provider.networkConfig.StreamIdleTimeoutInSeconds)
	jsonBody, bifrostErr := providerUtils.CheckContextAndGetRequestBody(
		ctx,
		request,
		func() (providerUtils.RequestBodyWithExtraParams, error) {
			return ToAliyunSpeechRequest(request)
		})
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	resp.StreamBody = true
	defer fasthttp.ReleaseRequest(req)

	providerUtils.SetExtraHeaders(ctx, req, provider.networkConfig.ExtraHeaders, nil)
	req.SetRequestURI(provider.buildNativeURL(ctx, aliyunImageGenerationPath))
	req.Header.SetMethod(http.MethodPost)
	req.Header.SetContentType("application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("X-DashScope-SSE", "enable")
	if value := key.Value.GetValue(); value != "" {
		req.Header.Set("Authorization", "Bearer "+value)
	}
	req.SetBody(jsonBody)

	startTime := time.Now()
	if err := provider.streamingClient.Do(req, resp); err != nil {
		defer providerUtils.ReleaseStreamingResponse(ctx, resp)
		if errors.Is(err, context.Canceled) {
			return nil, providerUtils.EnrichError(ctx, &schemas.BifrostError{
				IsBifrostError: false,
				Error: &schemas.ErrorField{
					Type:    schemas.Ptr(schemas.RequestCancelled),
					Message: schemas.ErrRequestCancelled,
					Error:   err,
				},
			}, jsonBody, nil, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
		}
		if errors.Is(err, fasthttp.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) {
			return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostTimeoutError(schemas.ErrProviderRequestTimedOut, err), jsonBody, nil, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
		}
		return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostUpstreamConnectionError(schemas.ErrProviderDoRequest, err), jsonBody, nil, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
	}

	ctx.SetValue(schemas.BifrostContextKeyProviderResponseHeaders, providerUtils.ExtractProviderResponseHeaders(resp))
	if resp.StatusCode() != fasthttp.StatusOK {
		defer providerUtils.ReleaseStreamingResponse(ctx, resp)
		providerUtils.MaterializeStreamErrorBody(ctx, resp)
		return nil, providerUtils.EnrichError(ctx, parseAliyunError(resp), jsonBody, nil, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
	}

	responseChan := make(chan *schemas.BifrostStreamChunk, schemas.DefaultStreamBufferSize)
	go provider.processAliyunSpeechStream(ctx, postHookRunner, postHookSpanFinalizer, resp, request, jsonBody, startTime, responseChan)
	return responseChan, nil
}

func (provider *AliyunProvider) processAliyunSpeechStream(ctx *schemas.BifrostContext, postHookRunner schemas.PostHookRunner, postHookSpanFinalizer func(context.Context), resp *fasthttp.Response, request *schemas.BifrostSpeechRequest, jsonBody []byte, startTime time.Time, responseChan chan *schemas.BifrostStreamChunk) {
	defer providerUtils.EnsureStreamFinalizerCalled(ctx, postHookSpanFinalizer)
	defer func() {
		if ctx.Err() == context.Canceled {
			providerUtils.HandleStreamCancellation(ctx, postHookRunner, responseChan, provider.logger, postHookSpanFinalizer, jsonBody)
		} else if ctx.Err() == context.DeadlineExceeded {
			providerUtils.HandleStreamTimeout(ctx, postHookRunner, responseChan, provider.logger, postHookSpanFinalizer, jsonBody)
		}
		providerUtils.CloseStream(ctx, responseChan)
	}()
	defer providerUtils.ReleaseStreamingResponse(ctx, resp)

	reader, releaseGzip := providerUtils.DecompressStreamBody(resp)
	defer releaseGzip()
	reader, stopIdleTimeout := providerUtils.NewIdleTimeoutReader(reader, resp.BodyStream(), providerUtils.GetStreamIdleTimeout(ctx), ctx)
	defer stopIdleTimeout()
	stopCancellation := providerUtils.SetupStreamCancellation(ctx, resp.BodyStream(), provider.logger)
	defer stopCancellation()

	reader, drained := providerUtils.DrainNonSSEStreamReader(resp, reader)
	if drained {
		ctx.SetValue(schemas.BifrostContextKeyStreamEndIndicator, true)
		providerUtils.ProcessAndSendError(ctx, postHookRunner, errors.New("provider returned non-SSE response for streaming request"), responseChan, provider.logger, postHookSpanFinalizer)
		return
	}

	sseReader := providerUtils.GetSSEDataReader(ctx, reader)
	chunkIndex := -1
	lastChunkTime := startTime
	for {
		if ctx.Err() != nil {
			return
		}
		data, readErr := sseReader.ReadDataLine()
		if readErr != nil {
			if ctx.Err() != nil {
				return
			}
			if readErr != io.EOF {
				ctx.SetValue(schemas.BifrostContextKeyStreamEndIndicator, true)
				providerUtils.ProcessAndSendError(ctx, postHookRunner, readErr, responseChan, provider.logger, postHookSpanFinalizer)
			}
			return
		}

		var aliyunResp AliyunSpeechResponse
		if err := sonic.Unmarshal(data, &aliyunResp); err != nil {
			provider.logger.Warn("failed to parse aliyun speech stream response: %v", err)
			continue
		}
		if bodyErr := aliyunResp.bifrostError(); bodyErr != nil {
			ctx.SetValue(schemas.BifrostContextKeyStreamEndIndicator, true)
			providerUtils.ProcessAndSendBifrostError(ctx, postHookRunner, providerUtils.EnrichError(ctx, bodyErr, jsonBody, data, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)), responseChan, provider.logger, postHookSpanFinalizer)
			return
		}

		response, err := aliyunResp.toBifrostSpeechStreamResponse(request)
		if err != nil {
			ctx.SetValue(schemas.BifrostContextKeyStreamEndIndicator, true)
			providerUtils.ProcessAndSendBifrostError(ctx, postHookRunner, providerUtils.EnrichError(ctx, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err), jsonBody, data, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)), responseChan, provider.logger, postHookSpanFinalizer)
			return
		}
		if response == nil {
			continue
		}

		chunkIndex++
		response.ExtraFields = schemas.BifrostResponseExtraFields{
			ChunkIndex: chunkIndex,
			Latency:    time.Since(lastChunkTime).Milliseconds(),
		}
		lastChunkTime = time.Now()
		if providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse) {
			response.ExtraFields.RawResponse = string(data)
		}
		if response.Type == schemas.SpeechStreamResponseTypeDone {
			response.ExtraFields.Latency = time.Since(startTime).Milliseconds()
			if providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest) {
				providerUtils.ParseAndSetRawRequest(&response.ExtraFields, jsonBody)
			}
			response.BackfillParams(request)
			ctx.SetValue(schemas.BifrostContextKeyStreamEndIndicator, true)
		}

		providerUtils.ProcessAndSendResponse(ctx, postHookRunner, providerUtils.GetBifrostResponseForStreamResponse(nil, nil, nil, response, nil, nil), responseChan, postHookSpanFinalizer)
		if response.Type == schemas.SpeechStreamResponseTypeDone {
			return
		}
	}
}

func (provider *AliyunProvider) aliyunSpeechResponseToBifrost(ctx *schemas.BifrostContext, response *AliyunSpeechResponse, request *schemas.BifrostSpeechRequest) (*schemas.BifrostSpeechResponse, *schemas.BifrostError) {
	if response == nil {
		return nil, providerUtils.NewBifrostOperationError("aliyun speech response is nil", nil)
	}

	audio, audioBase64, bifrostErr := provider.aliyunSpeechAudioBytes(ctx, response.Output.Audio)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	bifrostResp := &schemas.BifrostSpeechResponse{
		Audio:       audio,
		AudioBase64: audioBase64,
		Usage:       response.Usage.toBifrostSpeechUsage(),
	}
	bifrostResp.BackfillParams(request)
	return bifrostResp, nil
}

func (provider *AliyunProvider) aliyunSpeechAudioBytes(ctx *schemas.BifrostContext, audio AliyunSpeechAudio) ([]byte, *string, *schemas.BifrostError) {
	if strings.TrimSpace(audio.Data) != "" {
		decoded, err := decodeAliyunAudioData(audio.Data)
		if err != nil {
			return nil, nil, providerUtils.NewBifrostOperationError("failed to decode aliyun speech audio data", err)
		}
		audioBase64 := audio.Data
		return decoded, &audioBase64, nil
	}
	if strings.TrimSpace(audio.URL) != "" {
		body, _, _, _, bifrostErr := provider.downloadAliyunAsset(ctx, audio.URL)
		if bifrostErr != nil {
			return nil, nil, bifrostErr
		}
		return body, nil, nil
	}
	return nil, nil, providerUtils.NewBifrostOperationError("aliyun returned no speech audio data", nil)
}

func (response *AliyunSpeechResponse) bifrostError() *schemas.BifrostError {
	if response == nil {
		return nil
	}
	if response.Error != nil && strings.TrimSpace(response.Error.Message) != "" {
		statusCode := response.StatusCode
		if statusCode == 0 {
			statusCode = fasthttp.StatusInternalServerError
		}
		code := ""
		if response.Error.Code != nil {
			code = *response.Error.Code
		}
		return aliyunBodyStatusError(statusCode, code, response.Error.Message)
	}
	if response.StatusCode != 0 && response.StatusCode != fasthttp.StatusOK {
		return aliyunBodyStatusError(response.StatusCode, response.Code, response.Message)
	}
	if strings.TrimSpace(response.Code) != "" && !strings.EqualFold(strings.TrimSpace(response.Code), "Success") {
		return aliyunBodyStatusError(response.StatusCode, response.Code, response.Message)
	}
	return nil
}

func (response AliyunSpeechResponse) toBifrostSpeechStreamResponse(request *schemas.BifrostSpeechRequest) (*schemas.BifrostSpeechStreamResponse, error) {
	if strings.TrimSpace(response.Output.Audio.Data) == "" && !isAliyunSpeechDone(response) {
		return nil, nil
	}

	streamResp := &schemas.BifrostSpeechStreamResponse{
		Type: schemas.SpeechStreamResponseTypeDelta,
	}
	if strings.TrimSpace(response.Output.Audio.Data) != "" {
		audio, err := decodeAliyunAudioData(response.Output.Audio.Data)
		if err != nil {
			return nil, err
		}
		streamResp.Audio = audio
	}
	if isAliyunSpeechDone(response) {
		streamResp.Type = schemas.SpeechStreamResponseTypeDone
		streamResp.Usage = response.Usage.toBifrostSpeechUsage()
		streamResp.BackfillParams(request)
	}
	return streamResp, nil
}

func isAliyunSpeechDone(response AliyunSpeechResponse) bool {
	return strings.EqualFold(response.Output.FinishReason, "stop") || response.Usage.InputTokens > 0 || response.Usage.OutputTokens > 0 || response.Usage.TotalTokens > 0
}

func decodeAliyunAudioData(data string) ([]byte, error) {
	data = strings.TrimSpace(data)
	if comma := strings.Index(data, ","); comma >= 0 {
		data = data[comma+1:]
	}
	return base64.StdEncoding.DecodeString(data)
}

func (usage AliyunSpeechUsage) toBifrostSpeechUsage() *schemas.SpeechUsage {
	if usage.InputTokens == 0 && usage.OutputTokens == 0 && usage.TotalTokens == 0 && usage.InputTokenDetails == nil && usage.OutputTokensDetails == nil {
		return nil
	}
	result := &schemas.SpeechUsage{
		InputTokens:  usage.InputTokens,
		OutputTokens: usage.OutputTokens,
		TotalTokens:  usage.TotalTokens,
	}
	if usage.InputTokenDetails != nil {
		result.InputTokenDetails = usage.InputTokenDetails
	}
	return result
}
