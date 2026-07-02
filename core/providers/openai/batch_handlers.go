package openai

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/bytedance/sonic"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

// HandleOpenAIBatchCreateRequest 处理 OpenAI-compatible Batch 创建请求。
func HandleOpenAIBatchCreateRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	requestURL string,
	request *schemas.BifrostBatchCreateRequest,
	key schemas.Key,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostBatchCreateResponse, *schemas.BifrostError) {
	inputFileID := request.InputFileID
	if inputFileID == "" && len(request.Requests) > 0 {
		jsonlData, err := ConvertRequestsToJSONL(request.Requests)
		if err != nil {
			return nil, providerUtils.NewBifrostOperationError("failed to convert requests to JSONL", err)
		}
		fileUploadURL := strings.TrimSuffix(requestURL, "/batches") + "/files"
		uploadResp, bifrostErr := HandleOpenAIFileUploadRequest(ctx, client, fileUploadURL, &schemas.BifrostFileUploadRequest{
			Provider: request.Provider,
			File:     jsonlData,
			Filename: "batch_requests.jsonl",
			Purpose:  schemas.FilePurposeBatch,
		}, key, extraHeaders, providerName, sendBackRawRequest, sendBackRawResponse, logger)
		if bifrostErr != nil {
			return nil, bifrostErr
		}
		inputFileID = uploadResp.ID
	}
	if inputFileID == "" {
		return nil, providerUtils.NewBifrostOperationError("either input_file_id or requests array is required for OpenAI batch API", nil)
	}
	if request.Endpoint == "" {
		return nil, providerUtils.NewBifrostOperationError("endpoint is required for OpenAI batch API", nil)
	}

	openAIReq := &OpenAIBatchRequest{
		InputFileID:        schemas.Ptr(inputFileID),
		Endpoint:           string(request.Endpoint),
		CompletionWindow:   request.CompletionWindow,
		Metadata:           request.Metadata,
		OutputExpiresAfter: request.OutputExpiresAfter,
	}
	if openAIReq.CompletionWindow == "" {
		openAIReq.CompletionWindow = "24h"
	}
	jsonData, err := providerUtils.MarshalSorted(openAIReq)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError(schemas.ErrProviderRequestMarshal, err)
	}

	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
	req.SetRequestURI(requestURL)
	req.Header.SetMethod(http.MethodPost)
	req.Header.SetContentType("application/json")
	setBearerAuth(req, key)
	req.SetBody(jsonData)

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}
	if resp.StatusCode() != fasthttp.StatusOK {
		logProviderError(logger, providerName, resp)
		return nil, providerUtils.EnrichError(ctx, ParseOpenAIError(resp), jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	body, err := providerUtils.CheckAndDecodeBody(resp)
	if err != nil {
		return nil, providerUtils.EnrichError(ctx, providerUtils.NewBifrostOperationError(schemas.ErrProviderResponseDecode, err), jsonData, nil, sendBackRawRequest, sendBackRawResponse)
	}

	var openAIResp OpenAIBatchResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, jsonData, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, providerUtils.EnrichError(ctx, bifrostErr, jsonData, body, sendBackRawRequest, sendBackRawResponse)
	}
	return openAIResp.ToBifrostBatchCreateResponse(latency, sendBackRawRequest, sendBackRawResponse, rawRequest, rawResponse), nil
}

// HandleOpenAIBatchListRequest 处理 OpenAI-compatible Batch 列表请求。
func HandleOpenAIBatchListRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostBatchListRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostBatchListResponse, *schemas.BifrostError) {
	helper, err := providerUtils.NewSerialListHelper(keys, request.After, logger, true)
	if err != nil {
		return nil, providerUtils.NewBifrostOperationError("invalid pagination cursor", err)
	}
	key, nativeCursor, ok := helper.GetCurrentKey()
	if !ok {
		return &schemas.BifrostBatchListResponse{Object: "list", Data: []schemas.BifrostBatchRetrieveResponse{}, HasMore: false}, nil
	}

	requestURL := baseURL + "/batches"
	values := url.Values{}
	if request.Limit > 0 {
		values.Set("limit", fmt.Sprintf("%d", request.Limit))
	}
	if nativeCursor != "" {
		values.Set("after", nativeCursor)
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

	var openAIResp OpenAIBatchListResponse
	rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	batches := make([]schemas.BifrostBatchRetrieveResponse, 0, len(openAIResp.Data))
	var lastBatchID string
	for _, batch := range openAIResp.Data {
		batches = append(batches, *batch.ToBifrostBatchRetrieveResponse(latency, sendBackRawRequest, sendBackRawResponse, rawRequest, rawResponse))
		lastBatchID = batch.ID
	}
	nextCursor, hasMore := helper.BuildNextCursor(openAIResp.HasMore, lastBatchID)
	bifrostResp := &schemas.BifrostBatchListResponse{
		Object:  "list",
		Data:    batches,
		HasMore: hasMore,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency: latency.Milliseconds(),
		},
	}
	if nextCursor != "" {
		bifrostResp.NextCursor = &nextCursor
	}
	return bifrostResp, nil
}

// HandleOpenAIBatchRetrieveRequest 处理 OpenAI-compatible Batch 查询请求。
func HandleOpenAIBatchRetrieveRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostBatchRetrieveRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostBatchRetrieveResponse, *schemas.BifrostError) {
	if request.BatchID == "" {
		return nil, providerUtils.NewBifrostOperationError("batch_id is required", nil)
	}

	var lastErr *schemas.BifrostError
	for _, key := range keys {
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
		req.SetRequestURI(baseURL + "/batches/" + request.BatchID)
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

		var openAIResp OpenAIBatchResponse
		rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)
		if bifrostErr != nil {
			lastErr = bifrostErr
			continue
		}
		return openAIResp.ToBifrostBatchRetrieveResponse(latency, sendBackRawRequest, sendBackRawResponse, rawRequest, rawResponse), nil
	}
	return nil, lastErr
}

// HandleOpenAIBatchCancelRequest 处理 OpenAI-compatible Batch 取消请求。
func HandleOpenAIBatchCancelRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostBatchCancelRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	sendBackRawRequest bool,
	sendBackRawResponse bool,
	logger schemas.Logger,
) (*schemas.BifrostBatchCancelResponse, *schemas.BifrostError) {
	if request.BatchID == "" {
		return nil, providerUtils.NewBifrostOperationError("batch_id is required", nil)
	}

	var lastErr *schemas.BifrostError
	for _, key := range keys {
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		providerUtils.SetExtraHeaders(ctx, req, extraHeaders, nil)
		req.SetRequestURI(baseURL + "/batches/" + request.BatchID + "/cancel")
		req.Header.SetMethod(http.MethodPost)
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

		var openAIResp OpenAIBatchResponse
		rawRequest, rawResponse, bifrostErr := providerUtils.HandleProviderResponse(body, &openAIResp, nil, sendBackRawRequest, sendBackRawResponse)
		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)
		if bifrostErr != nil {
			lastErr = bifrostErr
			continue
		}

		result := &schemas.BifrostBatchCancelResponse{
			ID:           openAIResp.ID,
			Object:       openAIResp.Object,
			Status:       ToBifrostBatchStatus(openAIResp.Status),
			CancellingAt: openAIResp.CancellingAt,
			CancelledAt:  openAIResp.CancelledAt,
			ExtraFields: schemas.BifrostResponseExtraFields{
				Latency: latency.Milliseconds(),
			},
		}
		if openAIResp.RequestCounts != nil {
			result.RequestCounts = schemas.BatchRequestCounts{
				Total:     openAIResp.RequestCounts.Total,
				Completed: openAIResp.RequestCounts.Completed,
				Failed:    openAIResp.RequestCounts.Failed,
			}
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

// HandleOpenAIBatchResultsRequest 通过输出文件下载 OpenAI-compatible Batch 结果。
func HandleOpenAIBatchResultsRequest(
	ctx *schemas.BifrostContext,
	client *fasthttp.Client,
	baseURL string,
	keys []schemas.Key,
	request *schemas.BifrostBatchResultsRequest,
	extraHeaders map[string]string,
	providerName schemas.ModelProvider,
	logger schemas.Logger,
) (*schemas.BifrostBatchResultsResponse, *schemas.BifrostError) {
	if request.BatchID == "" {
		return nil, providerUtils.NewBifrostOperationError("batch_id is required", nil)
	}

	batchResp, bifrostErr := HandleOpenAIBatchRetrieveRequest(ctx, client, baseURL, keys, &schemas.BifrostBatchRetrieveRequest{
		Provider: request.Provider,
		BatchID:  request.BatchID,
	}, extraHeaders, providerName, false, false, logger)
	if bifrostErr != nil {
		return nil, bifrostErr
	}
	if batchResp.OutputFileID == nil || *batchResp.OutputFileID == "" {
		return nil, providerUtils.NewBifrostOperationError("batch results not available: output_file_id is empty (batch may not be completed)", nil)
	}

	contentResp, bifrostErr := HandleOpenAIFileContentRequest(ctx, client, baseURL, keys, &schemas.BifrostFileContentRequest{
		Provider: request.Provider,
		FileID:   *batchResp.OutputFileID,
	}, extraHeaders, providerName, logger)
	if bifrostErr != nil {
		return nil, bifrostErr
	}

	var results []schemas.BatchResultItem
	parseResult := providerUtils.ParseJSONL(contentResp.Content, func(line []byte) error {
		var resultItem schemas.BatchResultItem
		if err := sonic.Unmarshal(line, &resultItem); err != nil {
			if logger != nil {
				logger.Warn("failed to parse batch result line: %v", err)
			}
			return err
		}
		results = append(results, resultItem)
		return nil
	})

	batchResultsResp := &schemas.BifrostBatchResultsResponse{
		BatchID: request.BatchID,
		Results: results,
		ExtraFields: schemas.BifrostResponseExtraFields{
			Latency: contentResp.ExtraFields.Latency,
		},
	}
	if len(parseResult.Errors) > 0 {
		batchResultsResp.ExtraFields.ParseErrors = parseResult.Errors
	}
	return batchResultsResp, nil
}
