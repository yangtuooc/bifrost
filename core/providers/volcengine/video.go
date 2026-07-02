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

type VolcengineVideoTaskListResponse struct {
	Object  string                        `json:"object,omitempty"`
	Data    []VolcengineVideoTaskResponse `json:"data,omitempty"`
	Tasks   []VolcengineVideoTaskResponse `json:"tasks,omitempty"`
	Items   []VolcengineVideoTaskResponse `json:"items,omitempty"`
	FirstID *string                       `json:"first_id,omitempty"`
	LastID  *string                       `json:"last_id,omitempty"`
	HasMore *bool                         `json:"has_more,omitempty"`
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
	if response.ID != "" {
		response.ID = providerUtils.AddVideoIDProviderSuffix(response.ID, provider.GetProviderKey())
	}
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	response.BackfillParams(&schemas.BifrostRequest{VideoGenerationRequest: request})
	return response, nil
}

func (provider *VolcengineProvider) handleVideoRetrieve(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoRetrieveRequest) (*schemas.BifrostVideoGenerationResponse, *schemas.BifrostError) {
	videoID := providerUtils.StripVideoIDProviderSuffix(request.ID, provider.GetProviderKey())
	responseBody, latency, providerHeaders, bifrostErr := provider.doVolcengineJSONRequest(ctx, http.MethodGet, provider.volcengineURL(ctx, volcengineVideoTasksPath+"/"+url.PathEscape(videoID), nil), key, nil)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	var task VolcengineVideoTaskResponse
	if err := sonic.Unmarshal(responseBody, &task); err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseUnmarshal, err)
	}

	response := task.toBifrostVideoResponse("", "")
	if response.ID != "" {
		response.ID = providerUtils.AddVideoIDProviderSuffix(response.ID, provider.GetProviderKey())
	}
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	return response, nil
}

func (provider *VolcengineProvider) handleVideoDownload(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoDownloadRequest) (*schemas.BifrostVideoDownloadResponse, *schemas.BifrostError) {
	videoID := providerUtils.StripVideoIDProviderSuffix(request.ID, provider.GetProviderKey())
	retrieveResp, bifrostErr := provider.handleVideoRetrieve(ctx, key, &schemas.BifrostVideoRetrieveRequest{Provider: request.Provider, ID: videoID})
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
		VideoID:     providerUtils.AddVideoIDProviderSuffix(videoID, provider.GetProviderKey()),
		Content:     content,
		ContentType: contentType,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency:                 latency.Milliseconds(),
			ProviderResponseHeaders: providerHeaders,
		},
	}, nil
}

func (provider *VolcengineProvider) handleVideoList(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoListRequest) (*schemas.BifrostVideoListResponse, *schemas.BifrostError) {
	query := url.Values{}
	if request != nil {
		if request.After != nil && strings.TrimSpace(*request.After) != "" {
			query.Set("after", providerUtils.StripVideoIDProviderSuffix(*request.After, provider.GetProviderKey()))
		}
		if request.Limit != nil {
			query.Set("limit", strconv.Itoa(*request.Limit))
		}
		if request.Order != nil && strings.TrimSpace(*request.Order) != "" {
			query.Set("order", *request.Order)
		}
	}

	responseBody, latency, providerHeaders, bifrostErr := provider.doVolcengineJSONRequest(ctx, http.MethodGet, provider.volcengineURL(ctx, volcengineVideoTasksPath, query), key, nil)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	var taskList VolcengineVideoTaskListResponse
	if err := sonic.Unmarshal(responseBody, &taskList); err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseUnmarshal, err)
	}

	response := taskList.toBifrostVideoListResponse(provider.GetProviderKey())
	response.ExtraFields.Latency = latency.Milliseconds()
	response.ExtraFields.ProviderResponseHeaders = providerHeaders
	return response, nil
}

func (provider *VolcengineProvider) handleVideoDelete(ctx *schemas.BifrostContext, key schemas.Key, request *schemas.BifrostVideoDeleteRequest) (*schemas.BifrostVideoDeleteResponse, *schemas.BifrostError) {
	if request == nil || strings.TrimSpace(request.ID) == "" {
		return nil, providerUtils.NewBifrostOperationError("video id is required", nil)
	}
	videoID := providerUtils.StripVideoIDProviderSuffix(request.ID, provider.GetProviderKey())
	responseBody, latency, providerHeaders, bifrostErr := provider.doVolcengineJSONRequest(ctx, http.MethodDelete, provider.volcengineURL(ctx, volcengineVideoTasksPath+"/"+url.PathEscape(videoID), nil), key, nil)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	response := &schemas.BifrostVideoDeleteResponse{
		ID:      providerUtils.AddVideoIDProviderSuffix(videoID, provider.GetProviderKey()),
		Object:  "video.deleted",
		Deleted: true,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency:                 latency.Milliseconds(),
			ProviderResponseHeaders: providerHeaders,
		},
	}
	if len(responseBody) > 0 {
		var providerResp struct {
			ID      string `json:"id,omitempty"`
			Object  string `json:"object,omitempty"`
			Deleted *bool  `json:"deleted,omitempty"`
		}
		if err := sonic.Unmarshal(responseBody, &providerResp); err == nil {
			if providerResp.ID != "" {
				response.ID = providerUtils.AddVideoIDProviderSuffix(providerResp.ID, provider.GetProviderKey())
			}
			if providerResp.Object != "" {
				response.Object = providerResp.Object
			}
			if providerResp.Deleted != nil {
				response.Deleted = *providerResp.Deleted
			}
		}
	}
	return response, nil
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

func (task VolcengineVideoTaskResponse) toBifrostVideoObject(providerName schemas.ModelProvider) schemas.VideoObject {
	response := task.toBifrostVideoResponse("", "")
	object := schemas.VideoObject{
		ID:          providerUtils.AddVideoIDProviderSuffix(response.ID, providerName),
		Object:      firstNonEmpty(response.Object, "video"),
		Model:       response.Model,
		Status:      response.Status,
		CreatedAt:   response.CreatedAt,
		CompletedAt: response.CompletedAt,
		Progress:    response.Progress,
		Prompt:      response.Prompt,
		Seconds:     response.Seconds,
		Size:        response.Size,
		Error:       response.Error,
	}
	return object
}

func (taskList VolcengineVideoTaskListResponse) toBifrostVideoListResponse(providerName schemas.ModelProvider) *schemas.BifrostVideoListResponse {
	tasks := taskList.tasks()
	data := make([]schemas.VideoObject, 0, len(tasks))
	for _, task := range tasks {
		data = append(data, task.toBifrostVideoObject(providerName))
	}

	response := &schemas.BifrostVideoListResponse{
		Object:  firstNonEmpty(taskList.Object, "list"),
		Data:    data,
		FirstID: addVideoIDProviderSuffixPtr(taskList.FirstID, providerName),
		LastID:  addVideoIDProviderSuffixPtr(taskList.LastID, providerName),
		HasMore: taskList.HasMore,
	}
	if response.FirstID == nil && len(data) > 0 {
		response.FirstID = schemas.Ptr(data[0].ID)
	}
	if response.LastID == nil && len(data) > 0 {
		response.LastID = schemas.Ptr(data[len(data)-1].ID)
	}
	return response
}

func (taskList VolcengineVideoTaskListResponse) tasks() []VolcengineVideoTaskResponse {
	if len(taskList.Data) > 0 {
		return taskList.Data
	}
	if len(taskList.Tasks) > 0 {
		return taskList.Tasks
	}
	return taskList.Items
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

func addVideoIDProviderSuffixPtr(id *string, providerName schemas.ModelProvider) *string {
	if id == nil || strings.TrimSpace(*id) == "" {
		return nil
	}
	return schemas.Ptr(providerUtils.AddVideoIDProviderSuffix(*id, providerName))
}
