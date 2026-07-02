package aliyun

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
)

const (
	aliyunVideoGenerationPath = "/api/v1/services/aigc/video-generation/video-synthesis"
	aliyunTaskPath            = "/api/v1/tasks"
)

type AliyunVideoGenerationRequest struct {
	Model      string                 `json:"model"`
	Input      AliyunVideoInput       `json:"input"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

func (r *AliyunVideoGenerationRequest) GetExtraParams() map[string]interface{} {
	return r.Parameters
}

type AliyunVideoInput struct {
	Prompt         string `json:"prompt"`
	ImageURL       string `json:"img_url,omitempty"`
	AudioURL       string `json:"audio_url,omitempty"`
	VideoURL       string `json:"video_url,omitempty"`
	NegativePrompt string `json:"negative_prompt,omitempty"`
}

type AliyunVideoTaskResponse struct {
	RequestID string            `json:"request_id,omitempty"`
	Output    AliyunVideoOutput `json:"output,omitempty"`
	Usage     AliyunVideoUsage  `json:"usage,omitempty"`
}

type AliyunVideoOutput struct {
	TaskID              string `json:"task_id,omitempty"`
	TaskStatus          string `json:"task_status,omitempty"`
	VideoURL            string `json:"video_url,omitempty"`
	Code                string `json:"code,omitempty"`
	Message             string `json:"message,omitempty"`
	SubmitTime          string `json:"submit_time,omitempty"`
	ScheduledTime       string `json:"scheduled_time,omitempty"`
	EndTime             string `json:"end_time,omitempty"`
	InputVideoDuration  int    `json:"input_video_duration,omitempty"`
	OutputVideoDuration int    `json:"output_video_duration,omitempty"`
	VideoCount          int    `json:"video_count,omitempty"`
}

type AliyunVideoUsage struct {
	VideoCount int `json:"video_count,omitempty"`
}

func ToAliyunVideoGenerationRequest(request *schemas.BifrostVideoGenerationRequest) (*AliyunVideoGenerationRequest, error) {
	if request == nil || request.Input == nil || strings.TrimSpace(request.Input.Prompt) == "" {
		return nil, fmt.Errorf("video generation prompt is required")
	}

	req := &AliyunVideoGenerationRequest{
		Model: request.Model,
		Input: AliyunVideoInput{
			Prompt: request.Input.Prompt,
		},
	}
	if request.Input.InputReference != nil {
		req.Input.ImageURL = strings.TrimSpace(*request.Input.InputReference)
	}

	if request.Params != nil {
		req.Parameters = aliyunVideoParameters(request.Params)
		if request.Params.NegativePrompt != nil {
			req.Input.NegativePrompt = *request.Params.NegativePrompt
		}
		if request.Params.VideoURI != nil {
			req.Input.VideoURL = *request.Params.VideoURI
		}
		if value, ok := request.Params.ExtraParams["audio_url"].(string); ok {
			req.Input.AudioURL = value
			delete(req.Parameters, "audio_url")
		}
		if value, ok := request.Params.ExtraParams["img_url"].(string); ok && req.Input.ImageURL == "" {
			req.Input.ImageURL = value
			delete(req.Parameters, "img_url")
		}
		if value, ok := request.Params.ExtraParams["video_url"].(string); ok && req.Input.VideoURL == "" {
			req.Input.VideoURL = value
			delete(req.Parameters, "video_url")
		}
		if value, ok := request.Params.ExtraParams["negative_prompt"].(string); ok && req.Input.NegativePrompt == "" {
			req.Input.NegativePrompt = value
			delete(req.Parameters, "negative_prompt")
		}
		if len(req.Parameters) == 0 {
			req.Parameters = nil
		}
	}
	return req, nil
}

func (provider *AliyunProvider) handleVideoGeneration(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoGenerationRequest) (*schemas.BifrostVideoGenerationResponse, *schemas.BifrostError) {
	jsonData, bifrostErr := providerUtils.CheckContextAndGetRequestBody(
		ctx,
		request,
		func() (providerUtils.RequestBodyWithExtraParams, error) {
			return ToAliyunVideoGenerationRequest(request)
		})
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	sendBackRawRequest := providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest)
	sendBackRawResponse := providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)
	responseBody, latency, providerHeaders, bifrostErr := provider.doAliyunJSONRequest(ctx, http.MethodPost, provider.buildNativeURL(ctx, aliyunVideoGenerationPath), key, jsonData, map[string]string{"X-DashScope-Async": "enable"})
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, responseBody, sendBackRawRequest, sendBackRawResponse)
	}

	var task AliyunVideoTaskResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(responseBody, &task, jsonData, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if bodyErr := task.bifrostError(); bodyErr != nil {
		return nil, providerUtils.EnrichError(ctx, bodyErr, jsonData, responseBody, sendBackRawRequest, sendBackRawResponse)
	}

	response := task.toBifrostVideoResponse(request.Model, request.Input.Prompt)
	if response.CreatedAt == 0 {
		response.CreatedAt = time.Now().Unix()
	}
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	if sendBackRawRequest {
		response.ExtraFields.RawRequest = rawRequest
	}
	if sendBackRawResponse {
		response.ExtraFields.RawResponse = rawResponse
	}
	response.BackfillParams(&schemas.BifrostRequest{VideoGenerationRequest: request})
	return response, nil
}

func (provider *AliyunProvider) handleVideoRetrieve(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoRetrieveRequest) (*schemas.BifrostVideoGenerationResponse, *schemas.BifrostError) {
	responseBody, latency, providerHeaders, bifrostErr := provider.doAliyunJSONRequest(ctx, http.MethodGet, provider.buildNativeURL(ctx, aliyunTaskPath+"/"+url.PathEscape(request.ID)), key, nil, nil)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	var task AliyunVideoTaskResponse
	if err := sonic.Unmarshal(responseBody, &task); err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseUnmarshal, err)
	}
	if bodyErr := task.bifrostError(); bodyErr != nil {
		return nil, bodyErr
	}

	response := task.toBifrostVideoResponse("", "")
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	return response, nil
}

func (provider *AliyunProvider) handleVideoDownload(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoDownloadRequest) (*schemas.BifrostVideoDownloadResponse, *schemas.BifrostError) {
	retrieveResp, bifrostErr := provider.handleVideoRetrieve(ctx, key, &schemas.BifrostVideoRetrieveRequest{Provider: request.Provider, ID: request.ID})
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if retrieveResp == nil || len(retrieveResp.Videos) == 0 || retrieveResp.Videos[0].URL == nil || *retrieveResp.Videos[0].URL == "" {
		return nil, providerUtils.NewBifrostOperationError("aliyun video download URL is not available", nil)
	}

	content, contentType, latency, providerHeaders, bifrostErr := provider.downloadAliyunAsset(ctx, *retrieveResp.Videos[0].URL)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	return &schemas.BifrostVideoDownloadResponse{
		VideoID:     request.ID,
		Content:     content,
		ContentType: contentType,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency:                 latency.Milliseconds(),
			ProviderResponseHeaders: providerHeaders,
		},
	}, nil
}

func (task AliyunVideoTaskResponse) bifrostError() *schemas.BifrostError {
	if strings.TrimSpace(task.Output.TaskID) == "" && strings.TrimSpace(task.Output.Code) != "" {
		return aliyunBodyStatusError(500, task.Output.Code, task.Output.Message)
	}
	return nil
}

func (task AliyunVideoTaskResponse) toBifrostVideoResponse(defaultModel, defaultPrompt string) *schemas.BifrostVideoGenerationResponse {
	output := task.Output
	status := toBifrostAliyunVideoStatus(output.TaskStatus)
	response := &schemas.BifrostVideoGenerationResponse{
		ID:        output.TaskID,
		Object:    "video",
		Model:     defaultModel,
		Status:    status,
		CreatedAt: aliyunTimestamp(output.SubmitTime),
		Prompt:    defaultPrompt,
	}
	if completedAt := aliyunTimestamp(output.EndTime); completedAt > 0 {
		response.CompletedAt = &completedAt
	}
	if output.OutputVideoDuration > 0 {
		seconds := strconv.Itoa(output.OutputVideoDuration)
		response.Seconds = &seconds
	}
	if output.VideoURL != "" {
		videoURL := output.VideoURL
		response.Videos = []schemas.VideoOutput{{
			Type:        schemas.VideoOutputTypeURL,
			URL:         &videoURL,
			ContentType: "video/mp4",
		}}
	}
	if strings.EqualFold(output.TaskStatus, "FAILED") {
		response.Error = &schemas.VideoCreateError{Code: output.Code, Message: output.Message}
	}
	return response
}

func aliyunVideoParameters(params *schemas.VideoGenerationParameters) map[string]interface{} {
	if params == nil {
		return nil
	}
	result := map[string]interface{}{}
	if params.Seconds != nil {
		if duration, err := strconv.Atoi(strings.TrimSpace(*params.Seconds)); err == nil && duration > 0 {
			result["duration"] = duration
		}
	}
	if params.Size != "" {
		size := strings.TrimSpace(params.Size)
		switch {
		case strings.Contains(size, ":"):
			result["ratio"] = size
		case strings.HasSuffix(strings.ToLower(size), "p"):
			result["resolution"] = strings.ToUpper(size)
		default:
			result["size"] = size
		}
	}
	if params.Seed != nil {
		result["seed"] = *params.Seed
	}
	for key, value := range params.ExtraParams {
		result[key] = value
	}
	return result
}

func toBifrostAliyunVideoStatus(status string) schemas.VideoStatus {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "", "PENDING":
		return schemas.VideoStatusQueued
	case "RUNNING":
		return schemas.VideoStatusInProgress
	case "SUCCEEDED":
		return schemas.VideoStatusCompleted
	case "FAILED", "CANCELED", "UNKNOWN":
		return schemas.VideoStatusFailed
	default:
		return schemas.VideoStatusInProgress
	}
}

func aliyunTimestamp(value string) int64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if unixSeconds, err := strconv.ParseInt(value, 10, 64); err == nil {
		return unixSeconds
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05Z07:00"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.Unix()
		}
	}
	return 0
}
