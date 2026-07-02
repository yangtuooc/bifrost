package volcengine

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/maximhq/bifrost/core/providers/openai"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

const volcengineVideoTasksPath = "/contents/generations/tasks"

type VolcengineVideoTaskResponse struct {
	ID          string                       `json:"id,omitempty"`
	TaskID      string                       `json:"task_id,omitempty"`
	Object      string                       `json:"object,omitempty"`
	Model       string                       `json:"model,omitempty"`
	Status      string                       `json:"status,omitempty"`
	CreatedAt   int64                        `json:"created_at,omitempty"`
	UpdatedAt   int64                        `json:"updated_at,omitempty"`
	CompletedAt int64                        `json:"completed_at,omitempty"`
	Progress    *float64                     `json:"progress,omitempty"`
	Content     *VolcengineVideoTaskContent  `json:"content,omitempty"`
	Output      *VolcengineVideoTaskContent  `json:"output,omitempty"`
	Result      *VolcengineVideoTaskContent  `json:"result,omitempty"`
	Error       *schemas.VideoCreateError    `json:"error,omitempty"`
	Data        *VolcengineVideoTaskResponse `json:"data,omitempty"`
	Task        *VolcengineVideoTaskResponse `json:"task,omitempty"`
}

type VolcengineVideoTaskContent struct {
	VideoURL     string `json:"video_url,omitempty"`
	VideoUrl     string `json:"videoUrl,omitempty"`
	URL          string `json:"url,omitempty"`
	OutputURL    string `json:"output_url,omitempty"`
	DownloadURL  string `json:"download_url,omitempty"`
	LastFrameURL string `json:"last_frame_url,omitempty"`
}

func ToVolcengineVideoGenerationRequest(request *schemas.BifrostVideoGenerationRequest) (map[string]interface{}, error) {
	if request == nil || request.Input == nil || strings.TrimSpace(request.Input.Prompt) == "" {
		return nil, fmt.Errorf("video generation prompt is required")
	}

	body := map[string]interface{}{
		"model": request.Model,
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": request.Input.Prompt,
			},
		},
	}

	if request.Input.InputReference != nil && strings.TrimSpace(*request.Input.InputReference) != "" {
		body["content"] = append(body["content"].([]map[string]interface{}), map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]string{
				"url": *request.Input.InputReference,
			},
		})
	}

	if request.Params != nil {
		addVolcengineVideoParams(body, request.Params)
	}

	return body, nil
}

func addVolcengineVideoParams(body map[string]interface{}, params *schemas.VideoGenerationParameters) {
	if params.Seconds != nil {
		if duration, err := strconv.Atoi(strings.TrimSpace(*params.Seconds)); err == nil && duration > 0 {
			body["duration"] = duration
		}
	}
	if params.Size != "" {
		size := strings.TrimSpace(params.Size)
		switch {
		case strings.Contains(size, ":"):
			body["ratio"] = size
		case strings.HasSuffix(strings.ToLower(size), "p"):
			body["resolution"] = size
		default:
			body["size"] = size
		}
	}
	if params.NegativePrompt != nil {
		body["negative_prompt"] = *params.NegativePrompt
	}
	if params.Seed != nil {
		body["seed"] = *params.Seed
	}
	if params.Audio != nil {
		body["generate_audio"] = *params.Audio
	}
	if params.VideoURI != nil {
		body["video_uri"] = *params.VideoURI
	}
	for key, value := range params.ExtraParams {
		body[key] = value
	}
}

func (provider *VolcengineProvider) handleVideoGeneration(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoGenerationRequest) (*schemas.BifrostVideoGenerationResponse, *schemas.BifrostError) {
	jsonData, bifrostErr := volcengineVideoRequestBody(ctx, request)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	responseBody, latency, providerHeaders, bifrostErr := provider.doVolcengineJSONRequest(ctx, http.MethodPost, provider.volcengineURL(ctx, volcengineVideoTasksPath, nil), key, jsonData)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, responseBody, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
	}

	var task VolcengineVideoTaskResponse
	if err := sonic.Unmarshal(responseBody, &task); err != nil {
		return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseUnmarshal, err), jsonData, responseBody, providerUtils.ShouldSendBackRawRequest(ctx, provider.sendBackRawRequest), providerUtils.ShouldSendBackRawResponse(ctx, provider.sendBackRawResponse))
	}

	response := task.toBifrostVideoResponse(request.Model, request.Input.Prompt)
	if response.CreatedAt == 0 {
		response.CreatedAt = time.Now().Unix()
	}
	if response.Status == "" {
		response.Status = schemas.VideoStatusQueued
	}
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	response.BackfillParams(&schemas.BifrostRequest{VideoGenerationRequest: request})
	return response, nil
}

func (provider *VolcengineProvider) handleVideoRetrieve(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoRetrieveRequest) (*schemas.BifrostVideoGenerationResponse, *schemas.BifrostError) {
	responseBody, latency, providerHeaders, bifrostErr := provider.doVolcengineJSONRequest(ctx, http.MethodGet, provider.volcengineURL(ctx, volcengineVideoTasksPath+"/"+url.PathEscape(request.ID), nil), key, nil)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	var task VolcengineVideoTaskResponse
	if err := sonic.Unmarshal(responseBody, &task); err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseUnmarshal, err)
	}

	response := task.toBifrostVideoResponse("", "")
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	return response, nil
}

func (provider *VolcengineProvider) handleVideoDownload(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoDownloadRequest) (*schemas.BifrostVideoDownloadResponse, *schemas.BifrostError) {
	retrieveResp, bifrostErr := provider.handleVideoRetrieve(ctx, key, &schemas.BifrostVideoRetrieveRequest{Provider: request.Provider, ID: request.ID})
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if retrieveResp == nil || len(retrieveResp.Videos) == 0 || retrieveResp.Videos[0].URL == nil || *retrieveResp.Videos[0].URL == "" {
		return nil, providerUtils.NewBifrostOperationError("volcengine video download URL is not available", nil)
	}

	content, contentType, latency, providerHeaders, bifrostErr := provider.downloadVolcengineVideo(ctx, *retrieveResp.Videos[0].URL)
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

func volcengineVideoRequestBody(ctx *schemas.BifrostContext, request *schemas.BifrostVideoGenerationRequest) ([]byte, *schemas.BifrostError) {
	if rawBody, ok := providerUtils.CheckAndGetRawRequestBody(ctx, request); ok {
		return rawBody, nil
	}

	body, err := ToVolcengineVideoGenerationRequest(request)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrRequestBodyConversion, err)
	}

	jsonData, err := sonic.Marshal(body)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderRequestMarshal, err)
	}
	return jsonData, nil
}

func (provider *VolcengineProvider) doVolcengineJSONRequest(ctx *schemas.BifrostContext, method, requestURL string, key schemas.Key, body []byte) ([]byte, time.Duration, map[string]string, *schemas.BifrostError) {
	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, provider.networkConfig.ExtraHeaders, nil)
	req.SetRequestURI(requestURL)
	req.Header.SetMethod(method)
	if body != nil {
		req.Header.SetContentType("application/json")
		req.SetBody(body)
	}
	if value := key.Value.GetValue(); value != "" {
		req.Header.Set("Authorization", "Bearer "+value)
	}

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, provider.client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, latency, nil, bifrostErr
	}

	providerHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	ctx.SetValue(schemas.BifrostContextKeyProviderResponseHeaders, providerHeaders)

	if resp.StatusCode() < fasthttp.StatusOK || resp.StatusCode() >= fasthttp.StatusMultipleChoices {
		return append([]byte(nil), resp.Body()...), latency, providerHeaders, openai.ParseOpenAIError(resp)
	}

	bodyCopy := append([]byte(nil), resp.Body()...)
	return bodyCopy, latency, providerHeaders, nil
}

func (provider *VolcengineProvider) downloadVolcengineVideo(ctx *schemas.BifrostContext, videoURL string) ([]byte, string, time.Duration, map[string]string, *schemas.BifrostError) {
	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	req.SetRequestURI(videoURL)
	req.Header.SetMethod(http.MethodGet)

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, provider.client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, "", latency, nil, bifrostErr
	}

	providerHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	if resp.StatusCode() < fasthttp.StatusOK || resp.StatusCode() >= fasthttp.StatusMultipleChoices {
		return nil, "", latency, providerHeaders, openai.ParseOpenAIError(resp)
	}

	return append([]byte(nil), resp.Body()...), string(resp.Header.ContentType()), latency, providerHeaders, nil
}

func (provider *VolcengineProvider) volcengineURL(ctx *schemas.BifrostContext, defaultPath string, query url.Values) string {
	path := providerUtils.GetPathFromContext(ctx, defaultPath)
	if parsed, err := url.Parse(path); err == nil && parsed.IsAbs() && parsed.Host != "" {
		if len(query) > 0 {
			parsed.RawQuery = query.Encode()
		}
		return parsed.String()
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	requestURL := provider.networkConfig.BaseURL + path
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}
	return requestURL
}

func (task VolcengineVideoTaskResponse) toBifrostVideoResponse(defaultModel, defaultPrompt string) *schemas.BifrostVideoGenerationResponse {
	task = task.unwrapped()
	id := firstNonEmpty(task.ID, task.TaskID)
	content := task.videoContent()
	status := toBifrostVolcengineVideoStatus(task.Status)
	createdAt := task.CreatedAt
	if createdAt == 0 {
		createdAt = task.UpdatedAt
	}

	var completedAt *int64
	if task.CompletedAt > 0 {
		completedAt = &task.CompletedAt
	} else if status == schemas.VideoStatusCompleted && task.UpdatedAt > 0 {
		completedAt = &task.UpdatedAt
	}

	response := &schemas.BifrostVideoGenerationResponse{
		ID:          id,
		Object:      firstNonEmpty(task.Object, "video"),
		Model:       firstNonEmpty(task.Model, defaultModel),
		Status:      status,
		CreatedAt:   createdAt,
		CompletedAt: completedAt,
		Progress:    task.Progress,
		Prompt:      defaultPrompt,
		Error:       task.Error,
	}
	if content != nil {
		if videoURL := content.videoURL(); videoURL != "" {
			response.Videos = []schemas.VideoOutput{{
				Type:        schemas.VideoOutputTypeURL,
				URL:         &videoURL,
				ContentType: "video/mp4",
			}}
		}
	}
	return response
}

func (task VolcengineVideoTaskResponse) unwrapped() VolcengineVideoTaskResponse {
	if task.Data != nil {
		return task.Data.unwrapped()
	}
	if task.Task != nil {
		return task.Task.unwrapped()
	}
	return task
}

func (task VolcengineVideoTaskResponse) videoContent() *VolcengineVideoTaskContent {
	if task.Content != nil {
		return task.Content
	}
	if task.Output != nil {
		return task.Output
	}
	return task.Result
}

func (content *VolcengineVideoTaskContent) videoURL() string {
	if content == nil {
		return ""
	}
	return firstNonEmpty(content.VideoURL, content.VideoUrl, content.URL, content.OutputURL, content.DownloadURL)
}

func toBifrostVolcengineVideoStatus(status string) schemas.VideoStatus {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "queued", "pending", "submitted":
		return schemas.VideoStatusQueued
	case "running", "processing", "in_progress":
		return schemas.VideoStatusInProgress
	case "succeeded", "success", "completed", "done":
		return schemas.VideoStatusCompleted
	case "failed", "error", "cancelled", "canceled":
		return schemas.VideoStatusFailed
	default:
		return schemas.VideoStatusInProgress
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
