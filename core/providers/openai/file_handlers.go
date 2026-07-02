package openai

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

// HandleOpenAIFileUploadRequest 处理 OpenAI-compatible 文件上传请求。
func HandleOpenAIFileUploadRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	requestURL string,
	request *schemas.BifrostFileUploadRequest,
	key schemas.Key,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostFileUploadResponse, *schemas.BifrostError) {
	if len(request.File) == 0 {
		return nil, providerUtils.NewBifrostOperationError("file content is required", nil)
	}
	if request.Purpose == "" {
		return nil, providerUtils.NewBifrostOperationError("purpose is required", nil)
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	if err := writer.WriteField("purpose", string(request.Purpose)); err != nil {
		return nil, providerUtils.NewBifrostOperationError("failed to write purpose field", err)
	}
	if request.ExpiresAfter != nil {
		if err := writer.WriteField("expires_after[anchor]", request.ExpiresAfter.Anchor); err != nil {
			return nil, providerUtils.NewBifrostOperationError("failed to write expires_after[anchor] field", err)
		}
		if err := writer.WriteField("expires_after[seconds]", fmt.Sprintf("%d", request.ExpiresAfter.Seconds)); err != nil {
			return nil, providerUtils.NewBifrostOperationError("failed to write expires_after[seconds] field", err)
		}
	}

	filename := request.Filename
	if filename == "" {
		filename = "file.jsonl"
	}
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError("failed to create form file", err)
	}
	if _, err := part.Write(request.File); err != nil {
		return nil, providerUtils.NewBifrostOperationError("failed to write file content", err)
	}
	if err := writer.Close(); err != nil {
		return nil, providerUtils.NewBifrostOperationError("failed to close multipart writer", err)
	}

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
	req.SetRequestURI(requestURL)
	req.Header.SetMethod(http.MethodPost)
	req.Header.SetContentType(writer.FormDataContentType())
	setBearerAuth(req, key)
	req.SetBody(buf.Bytes())

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if resp.StatusCode() != fasthttp.StatusOK {
		logProviderError(logger, providerName, resp)
		return nil, ParseOpenAIError(resp)
	}

	body, err := providerUtils.CheckAndDecodeBody(resp)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err)
	}

	var openAIResp OpenAIFileResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	fileResponse := openAIResp.ToBifrostFileUploadResponse(latency, sendBackRawRequest, sendBackRawResponse, rawRequest, rawResponse)
	fileResponse.ExtraFields.ProviderResponseHeaders = providerUtils.ExtractProviderResponseHeaders(resp)
	return fileResponse, nil
}

// HandleOpenAIFileListRequest 处理 OpenAI-compatible 文件列表请求。
func HandleOpenAIFileListRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostFileListRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostFileListResponse, *schemas.BifrostError) {
	helper, err := providerUtils.NewSerialListHelper(keys, request.After, logger, true)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError("invalid pagination cursor", err)
	}
	key, nativeCursor, ok := helper.GetCurrentKey()
	if !ok {
		return &schemas.BifrostFileListResponse{Object: "list", Data: []schemas.FileObject{}, HasMore: false}, nil
	}

	requestURL := baseURL + "/files"
	values := url.Values{}
	if request.Purpose != "" {
		values.Set("purpose", string(request.Purpose))
	}
	if request.Limit > 0 {
		values.Set("limit", fmt.Sprintf("%d", request.Limit))
	}
	if nativeCursor != "" {
		values.Set("after", nativeCursor)
	}
	if request.Order != nil && *request.Order != "" {
		values.Set("order", *request.Order)
	}
	if encoded := values.Encode(); encoded != "" {
		requestURL += "?" + encoded
	}

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
	req.SetRequestURI(requestURL)
	req.Header.SetMethod(http.MethodGet)
	req.Header.SetContentType("application/json")
	setBearerAuth(req, key)

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if resp.StatusCode() != fasthttp.StatusOK {
		logProviderError(logger, providerName, resp)
		return nil, ParseOpenAIError(resp)
	}

	body, err := providerUtils.CheckAndDecodeBody(resp)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err)
	}

	var openAIResp OpenAIFileListResponse
	_, _, bifrostErr = providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	files := make([]schemas.FileObject, 0, len(openAIResp.Data))
	var lastFileID string
	for _, file := range openAIResp.Data {
		files = append(files, schemas.FileObject{
			ID:            file.ID,
			Object:        file.Object,
			Bytes:         file.Bytes,
			CreatedAt:     file.CreatedAt,
			Filename:      file.Filename,
			Purpose:       schemas.FilePurpose(file.Purpose),
			Status:        ToBifrostFileStatus(file.Status),
			StatusDetails: file.StatusDetails,
		})
		lastFileID = file.ID
	}

	nextCursor, hasMore := helper.BuildNextCursor(openAIResp.HasMore, lastFileID)
	bifrostResp := &schemas.BifrostFileListResponse{
		Object:  "list",
		Data:    files,
		HasMore: hasMore,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency:                 latency.Milliseconds(),
			ProviderResponseHeaders: providerUtils.ExtractProviderResponseHeaders(resp),
		},
	}
	if nextCursor != "" {
		bifrostResp.After = &nextCursor
	}
	return bifrostResp, nil
}

// HandleOpenAIFileRetrieveRequest 处理 OpenAI-compatible 文件元数据查询。
func HandleOpenAIFileRetrieveRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostFileRetrieveRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostFileRetrieveResponse, *schemas.BifrostError) {
	if request.FileID == "" {
		return nil, providerUtils.NewBifrostOperationError("file_id is required", nil)
	}

	var lastErr *schemas.BifrostError
	for _, key := range keys {
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
		req.SetRequestURI(baseURL + "/files/" + request.FileID)
		req.Header.SetMethod(http.MethodGet)
		req.Header.SetContentType("application/json")
		setBearerAuth(req, key)

		latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
		wait()
		if bifrostErr != nil {
			lastErr = bifrostErr
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}
		if resp.StatusCode() != fasthttp.StatusOK {
			logProviderError(logger, providerName, resp)
			lastErr = ParseOpenAIError(resp)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}

		body, err := providerUtils.CheckAndDecodeBody(resp)
		if err != nil {
			lastErr = providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}

		var openAIResp OpenAIFileResponse
		rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)
		if bifrostErr != nil {
			lastErr = bifrostErr
			continue
		}
		return openAIResp.ToBifrostFileRetrieveResponse(providerName, latency, sendBackRawRequest, sendBackRawResponse, rawRequest, rawResponse), nil
	}
	return nil, lastErr
}

// HandleOpenAIFileDeleteRequest 处理 OpenAI-compatible 文件删除。
func HandleOpenAIFileDeleteRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostFileDeleteRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostFileDeleteResponse, *schemas.BifrostError) {
	if request.FileID == "" {
		return nil, providerUtils.NewBifrostOperationError("file_id is required", nil)
	}

	var lastErr *schemas.BifrostError
	for _, key := range keys {
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
		req.SetRequestURI(baseURL + "/files/" + request.FileID)
		req.Header.SetMethod(http.MethodDelete)
		req.Header.SetContentType("application/json")
		setBearerAuth(req, key)

		latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
		wait()
		if bifrostErr != nil {
			lastErr = bifrostErr
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}
		if resp.StatusCode() != fasthttp.StatusOK {
			logProviderError(logger, providerName, resp)
			lastErr = ParseOpenAIError(resp)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}

		body, err := providerUtils.CheckAndDecodeBody(resp)
		if err != nil {
			lastErr = providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}

		var openAIResp OpenAIFileDeleteResponse
		rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)
		if bifrostErr != nil {
			lastErr = bifrostErr
			continue
		}

		result := &schemas.BifrostFileDeleteResponse{
			ID:      openAIResp.ID,
			Object:  openAIResp.Object,
			Deleted: openAIResp.Deleted,
			ExtraFields: schemas.BifrostResponseExtraFields{
				Latency: latency.Milliseconds(),
			},
		}
		if sendBackRawRequest {
			result.ExtraFields.RawRequest = rawRequest
		}
		if sendBackRawResponse {
			result.ExtraFields.RawResponse = rawResponse
		}
		return result, nil
	}
	return nil, lastErr
}

// HandleOpenAIFileContentRequest 处理 OpenAI-compatible 文件内容下载。
func HandleOpenAIFileContentRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostFileContentRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	logger schemas.Logger,
) (*schemas.BifrostFileContentResponse, *schemas.BifrostError) {
	if request.FileID == "" {
		return nil, providerUtils.NewBifrostOperationError("file_id is required", nil)
	}

	var lastErr *schemas.BifrostError
	for _, key := range keys {
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
		req.SetRequestURI(baseURL + "/files/" + request.FileID + "/content")
		req.Header.SetMethod(http.MethodGet)
		setBearerAuth(req, key)

		latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
		wait()
		if bifrostErr != nil {
			lastErr = bifrostErr
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}
		if resp.StatusCode() != fasthttp.StatusOK {
			logProviderError(logger, providerName, resp)
			lastErr = ParseOpenAIError(resp)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}

		body, err := providerUtils.CheckAndDecodeBody(resp)
		if err != nil {
			lastErr = providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err)
			fasthttp.ReleaseRequest(req)
			fasthttp.ReleaseResponse(resp)
			continue
		}
		contentType := string(resp.Header.ContentType())
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		content := append([]byte(nil), body...)
		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)

		return &schemas.BifrostFileContentResponse{
			FileID:      request.FileID,
			Content:     content,
			ContentType: contentType,
			ExtraFields: schemas.BifrostResponseExtraFields{
				Latency: latency.Milliseconds(),
			},
		}, nil
	}
	return nil, lastErr
}

func setBearerAuth(req *fasthttp.Request, key schemas.Key) {
	if key.Value.GetValue() != "" {
		req.Header.Set("Authorization", "Bearer "+key.Value.GetValue())
	}
}

func logProviderError(logger schemas.Logger, providerName schemas.ModelProvider, resp *fasthttp.Response) {
	if logger != nil {
		logger.Debug("error from %s provider: %s", providerName, string(resp.Body()))
	}
}
