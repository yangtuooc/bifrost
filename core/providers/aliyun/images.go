package aliyun

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

const aliyunImageGenerationPath = "/api/v1/services/aigc/multimodal-generation/generation"

type AliyunImageGenerationRequest struct {
	Model      string                 `json:"model"`
	Input      AliyunImageInput       `json:"input"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

func (r *AliyunImageGenerationRequest) GetExtraParams() map[string]interface{} {
	return nil
}

type AliyunImageInput struct {
	Messages []AliyunImageMessage `json:"messages"`
}

type AliyunImageMessage struct {
	Role    string               `json:"role"`
	Content []AliyunImageContent `json:"content"`
}

type AliyunImageContent struct {
	Text  string `json:"text,omitempty"`
	Image string `json:"image,omitempty"`
}

type AliyunImageGenerationResponse struct {
	RequestID string            `json:"request_id"`
	Output    AliyunImageOutput `json:"output"`
	Usage     AliyunImageUsage  `json:"usage"`
}

type AliyunImageOutput struct {
	Choices []AliyunImageChoice `json:"choices"`
}

type AliyunImageChoice struct {
	FinishReason string             `json:"finish_reason"`
	Message      AliyunImageMessage `json:"message"`
}

type AliyunImageUsage struct {
	Width      int `json:"width"`
	Height     int `json:"height"`
	ImageCount int `json:"image_count"`
}

func (provider *AliyunProvider) handleImageGeneration(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostImageGenerationRequest) (*schemas.BifrostImageGenerationResponse, *schemas.BifrostError) {
	jsonData, bifrostErr := providerUtils.CheckContextAndGetRequestBody(
		ctx,
		request,
		func() (providerUtils.RequestBodyWithExtraParams, error) {
			return ToAliyunImageGenerationRequest(request)
		})
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	sendBackRawRequest := providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest)
	sendBackRawResponse := providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, provider.networkConfig.ExtraHeaders, nil)
	req.SetRequestURI(provider.buildNativeURL(ctx, aliyunImageGenerationPath))
	req.Header.SetMethod(http.MethodPost)
	req.Header.SetContentType("application/json")
	if value := key.Value.GetValue(); value != "" {
		req.Header.Set("Authorization", "Bearer "+value)
	}
	req.SetBody(jsonData)

	activeClient := providerUtils.PrepareResponseStreaming(ctx, provider.client, resp)
	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, activeClient, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	providerResponseHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	ctx.SetValue(schemas.BifrostContextKeyProviderResponseHeaders, providerResponseHeaders)

	if resp.StatusCode() != fasthttp.StatusOK {
		provider.logger.Debug("error from aliyun image provider: %s", string(resp.Body()))
		return nil, providerUtils.EnrichError(ctx, parseAliyunError(resp), jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	body, err := providerUtils.CheckAndDecodeBody(resp)
	if err != nil {
		rawErrBody := append([]byte(nil), resp.Body()...)
		return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err), jsonData, rawErrBody, sendBackRawRequest, sendBackRawResponse)
	}

	var aliyunResp AliyunImageGenerationResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &aliyunResp, jsonData, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	response, bifrostErr := ToBifrostImageGenerationResponse(&aliyunResp, request)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, body, sendBackRawRequest, sendBackRawResponse)
	}

	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerResponseHeaders
	if sendBackRawRequest {
		response.ExtraFields.RawRequest = rawRequest
	}
	if sendBackRawResponse {
		response.ExtraFields.RawResponse = rawResponse
	}

	return response, nil
}

func ToAliyunImageGenerationRequest(bifrostReq *schemas.BifrostImageGenerationRequest) (*AliyunImageGenerationRequest, error) {
	if bifrostReq == nil || bifrostReq.Input == nil || strings.TrimSpace(bifrostReq.Input.Prompt) == "" {
		return nil, fmt.Errorf("image generation prompt is required")
	}

	req := &AliyunImageGenerationRequest{
		Model: bifrostReq.Model,
		Input: AliyunImageInput{
			Messages: []AliyunImageMessage{
				{
					Role: "user",
					Content: []AliyunImageContent{
						{Text: bifrostReq.Input.Prompt},
					},
				},
			},
		},
	}

	if bifrostReq.Params != nil {
		params := aliyunImageGenerationParameters(bifrostReq.Params)
		if len(params) > 0 {
			req.Parameters = params
		}
	}

	return req, nil
}

func ToAliyunImageEditRequest(bifrostReq *schemas.BifrostImageEditRequest) (*AliyunImageGenerationRequest, error) {
	if bifrostReq == nil || bifrostReq.Input == nil || strings.TrimSpace(bifrostReq.Input.Prompt) == "" {
		return nil, fmt.Errorf("image edit prompt is required")
	}
	if len(bifrostReq.Input.Images) == 0 {
		return nil, fmt.Errorf("image edit input image is required")
	}
	if len(bifrostReq.Input.Images) > 3 {
		return nil, fmt.Errorf("aliyun image edit supports at most 3 input images")
	}

	content := make([]AliyunImageContent, 0, len(bifrostReq.Input.Images)+1)
	for index, image := range bifrostReq.Input.Images {
		if len(image.Image) == 0 {
			return nil, fmt.Errorf("image edit input image %d is empty", index)
		}
		content = append(content, AliyunImageContent{Image: dataURLFromImageBytes(image.Image)})
	}
	content = append(content, AliyunImageContent{Text: bifrostReq.Input.Prompt})

	req := &AliyunImageGenerationRequest{
		Model: bifrostReq.Model,
		Input: AliyunImageInput{
			Messages: []AliyunImageMessage{
				{
					Role:    "user",
					Content: content,
				},
			},
		},
	}

	if bifrostReq.Params != nil {
		params := aliyunImageEditParameters(bifrostReq.Params)
		if len(params) > 0 {
			req.Parameters = params
		}
	}

	return req, nil
}

func (provider *AliyunProvider) handleImageEdit(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostImageEditRequest) (*schemas.BifrostImageGenerationResponse, *schemas.BifrostError) {
	jsonData, bifrostErr := providerUtils.CheckContextAndGetRequestBody(
		ctx,
		request,
		func() (providerUtils.RequestBodyWithExtraParams, error) {
			return ToAliyunImageEditRequest(request)
		})
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	sendBackRawRequest := providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest)
	sendBackRawResponse := providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse)

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, provider.networkConfig.ExtraHeaders, nil)
	req.SetRequestURI(provider.buildNativeURL(ctx, aliyunImageGenerationPath))
	req.Header.SetMethod(http.MethodPost)
	req.Header.SetContentType("application/json")
	if value := key.Value.GetValue(); value != "" {
		req.Header.Set("Authorization", "Bearer "+value)
	}
	req.SetBody(jsonData)

	activeClient := providerUtils.PrepareResponseStreaming(ctx, provider.client, resp)
	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, activeClient, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	providerResponseHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	ctx.SetValue(schemas.BifrostContextKeyProviderResponseHeaders, providerResponseHeaders)

	if resp.StatusCode() != fasthttp.StatusOK {
		provider.logger.Debug("error from aliyun image edit provider: %s", string(resp.Body()))
		return nil, providerUtils.EnrichError(ctx, parseAliyunError(resp), jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	body, err := providerUtils.CheckAndDecodeBody(resp)
	if err != nil {
		rawErrBody := append([]byte(nil), resp.Body()...)
		return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err), jsonData, rawErrBody, sendBackRawRequest, sendBackRawResponse)
	}

	var aliyunResp AliyunImageGenerationResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &aliyunResp, jsonData, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	response, bifrostErr := ToBifrostImageEditResponse(&aliyunResp, request)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, body, sendBackRawRequest, sendBackRawResponse)
	}

	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerResponseHeaders
	if sendBackRawRequest {
		response.ExtraFields.RawRequest = rawRequest
	}
	if sendBackRawResponse {
		response.ExtraFields.RawResponse = rawResponse
	}

	return response, nil
}

func ToBifrostImageGenerationResponse(response *AliyunImageGenerationResponse, request *schemas.BifrostImageGenerationRequest) (*schemas.BifrostImageGenerationResponse, *schemas.BifrostError) {
	bifrostResp, bifrostErr := aliyunImageResponseToBifrost(response)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if request != nil {
		bifrostResp.Model = request.Model
	}
	bifrostResp.BackfillParams(&schemas.BifrostRequest{ImageGenerationRequest: request})
	return bifrostResp, nil
}

func ToBifrostImageEditResponse(response *AliyunImageGenerationResponse, request *schemas.BifrostImageEditRequest) (*schemas.BifrostImageGenerationResponse, *schemas.BifrostError) {
	bifrostResp, bifrostErr := aliyunImageResponseToBifrost(response)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if request != nil {
		bifrostResp.Model = request.Model
	}
	bifrostResp.BackfillParams(&schemas.BifrostRequest{ImageEditRequest: request})
	return bifrostResp, nil
}

func aliyunImageResponseToBifrost(response *AliyunImageGenerationResponse) (*schemas.BifrostImageGenerationResponse, *schemas.BifrostError) {
	if response == nil {
		return nil, providerUtils.NewBifrostOperationError("aliyun image response is nil", nil)
	}

	data := make([]schemas.ImageData, 0)
	finishReasons := make([]*string, 0)
	for _, choice := range response.Output.Choices {
		if choice.FinishReason != "" {
			reason := choice.FinishReason
			finishReasons = append(finishReasons, &reason)
		}
		for _, content := range choice.Message.Content {
			if content.Image == "" {
				continue
			}
			data = append(data, schemas.ImageData{
				URL:   content.Image,
				Index: len(data),
			})
		}
	}
	if len(data) == 0 {
		return nil, providerUtils.NewBifrostOperationError("aliyun returned no generated images", nil)
	}

	bifrostResp := &schemas.BifrostImageGenerationResponse{
		ID:      response.RequestID,
		Created: time.Now().Unix(),
		Data:    data,
	}

	params := &schemas.ImageGenerationResponseParameters{}
	if response.Usage.Width > 0 && response.Usage.Height > 0 {
		params.Size = fmt.Sprintf("%dx%d", response.Usage.Width, response.Usage.Height)
	}
	if len(finishReasons) > 0 {
		params.FinishReasons = finishReasons
	}
	if params.Size != "" || len(params.FinishReasons) > 0 {
		bifrostResp.ImageGenerationResponseParameters = params
	}

	if response.Usage.ImageCount > 0 {
		bifrostResp.Usage = &schemas.ImageUsage{
			OutputTokensDetails: &schemas.ImageTokenDetails{
				NImages: response.Usage.ImageCount,
			},
		}
	}

	return bifrostResp, nil
}

func (provider *AliyunProvider) buildNativeURL(ctx *schemas.BifrostContext, defaultPath string) string {
	path := providerUtils.GetPathFromContext(ctx, defaultPath)
	if parsed, err := url.Parse(path); err == nil && parsed.IsAbs() && parsed.Host != "" {
		return path
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return aliyunNativeBaseURL(provider.networkConfig.BaseURL) + path
}

func aliyunNativeBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	for _, suffix := range []string{"/compatible-mode/v1", "/compatible-mode", "/api/v1"} {
		if strings.HasSuffix(baseURL, suffix) {
			return strings.TrimRight(strings.TrimSuffix(baseURL, suffix), "/")
		}
	}
	return baseURL
}

func toAliyunImageSize(size string) string {
	size = strings.TrimSpace(size)
	if size == "" || strings.EqualFold(size, "auto") {
		return ""
	}
	size = strings.ReplaceAll(size, "X", "*")
	return strings.ReplaceAll(size, "x", "*")
}

func dataURLFromImageBytes(image []byte) string {
	contentType := http.DetectContentType(image)
	return fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(image))
}

func aliyunImageGenerationParameters(params *schemas.ImageGenerationParameters) map[string]interface{} {
	if params == nil {
		return nil
	}
	result := map[string]interface{}{}
	if params.NegativePrompt != nil {
		result["negative_prompt"] = *params.NegativePrompt
	}
	if params.N != nil {
		result["n"] = *params.N
	}
	if params.Seed != nil {
		result["seed"] = *params.Seed
	}
	if params.Size != nil {
		if size := toAliyunImageSize(*params.Size); size != "" {
			result["size"] = size
		}
	}
	for key, value := range params.ExtraParams {
		result[key] = value
	}
	return result
}

func aliyunImageEditParameters(params *schemas.ImageEditParameters) map[string]interface{} {
	if params == nil {
		return nil
	}
	result := map[string]interface{}{}
	if params.NegativePrompt != nil {
		result["negative_prompt"] = *params.NegativePrompt
	}
	if params.N != nil {
		result["n"] = *params.N
	}
	if params.Seed != nil {
		result["seed"] = *params.Seed
	}
	if params.Size != nil {
		if size := toAliyunImageSize(*params.Size); size != "" {
			result["size"] = size
		}
	}
	for key, value := range params.ExtraParams {
		result[key] = value
	}
	return result
}
