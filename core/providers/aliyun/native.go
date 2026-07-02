package aliyun

import (
	"net/http"
	"strings"
	"time"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

func (provider *AliyunProvider) doAliyunJSONRequest(ctx *schemas.BifrostContext, method, requestURL string, key schemas.Key, body []byte, headers map[string]string) ([]byte, time.Duration, map[string]string, *schemas.BifrostError) {
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
	for name, value := range headers {
		req.Header.Set(name, value)
	}

	activeClient := providerUtils.PrepareResponseStreaming(ctx, provider.client, resp)
	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, activeClient, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, latency, nil, bifrostErr
	}

	providerHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	ctx.SetValue(schemas.BifrostContextKeyProviderResponseHeaders, providerHeaders)

	if resp.StatusCode() < fasthttp.StatusOK || resp.StatusCode() >= fasthttp.StatusMultipleChoices {
		return append([]byte(nil), resp.Body()...), latency, providerHeaders, parseAliyunError(resp)
	}

	return append([]byte(nil), resp.Body()...), latency, providerHeaders, nil
}

func (provider *AliyunProvider) downloadAliyunAsset(ctx *schemas.BifrostContext, assetURL string) ([]byte, string, time.Duration, map[string]string, *schemas.BifrostError) {
	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	req.SetRequestURI(assetURL)
	req.Header.SetMethod(http.MethodGet)

	latency, bifrostErr, wait := providerUtils.MakeRequestWithContext(ctx, provider.client, req, resp)
	defer wait()
	if bifrostErr != nil {
		return nil, "", latency, nil, bifrostErr
	}

	providerHeaders := providerUtils.ExtractProviderResponseHeaders(resp)
	if resp.StatusCode() < fasthttp.StatusOK || resp.StatusCode() >= fasthttp.StatusMultipleChoices {
		return nil, "", latency, providerHeaders, parseAliyunError(resp)
	}

	body := append([]byte(nil), resp.Body()...)
	contentType := strings.TrimSpace(string(resp.Header.ContentType()))
	if contentType == "" && len(body) > 0 {
		contentType = http.DetectContentType(body)
	}
	return body, contentType, latency, providerHeaders, nil
}

func aliyunBodyStatusError(statusCode int, code, message string) *schemas.BifrostError {
	if statusCode <= 0 {
		statusCode = fasthttp.StatusInternalServerError
	}
	if strings.TrimSpace(message) == "" {
		message = "aliyun API error"
	}
	errorType := code
	if strings.TrimSpace(errorType) == "" {
		errorType = defaultAliyunErrorCode(statusCode)
	}
	bifrostErr := providerUtils.NewProviderAPIError(message, nil, statusCode, &errorType, nil)
	if bifrostErr.Error != nil {
		bifrostErr.Error.Code = schemas.Ptr(errorType)
	}
	return bifrostErr
}
