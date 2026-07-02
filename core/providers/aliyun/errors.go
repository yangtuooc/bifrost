package aliyun

import (
	"fmt"
	"strings"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

type AliyunErrorResponse struct {
	Code      string              `json:"code,omitempty"`
	Message   string              `json:"message,omitempty"`
	RequestID string              `json:"request_id,omitempty"`
	Error     *schemas.ErrorField `json:"error,omitempty"`
}

func parseAliyunError(resp *fasthttp.Response) *schemas.BifrostError {
	var errorResp AliyunErrorResponse
	bifrostErr := providerUtils.HandleProviderAPIError(resp, &errorResp)
	if bifrostErr.Error == nil {
		bifrostErr.Error = &schemas.ErrorField{}
	}

	if errorResp.Error != nil {
		if errorResp.Error.Message != "" {
			bifrostErr.Error.Message = errorResp.Error.Message
		}
		if errorResp.Error.Code != nil {
			bifrostErr.Error.Code = errorResp.Error.Code
		}
		if errorResp.Error.Type != nil {
			bifrostErr.Error.Type = errorResp.Error.Type
		}
		if errorResp.Error.Param != nil {
			bifrostErr.Error.Param = errorResp.Error.Param
		}
	}

	if strings.TrimSpace(errorResp.Message) != "" {
		bifrostErr.Error.Message = errorResp.Message
	}
	if strings.TrimSpace(errorResp.Code) != "" {
		bifrostErr.Error.Code = schemas.Ptr(errorResp.Code)
	}
	if strings.TrimSpace(errorResp.RequestID) != "" {
		bifrostErr.EventID = schemas.Ptr(errorResp.RequestID)
		bifrostErr.Error.EventID = schemas.Ptr(errorResp.RequestID)
	}
	if bifrostErr.Error.Code == nil && bifrostErr.StatusCode != nil {
		bifrostErr.Error.Code = schemas.Ptr(defaultAliyunErrorCode(*bifrostErr.StatusCode))
	}
	if strings.TrimSpace(bifrostErr.Error.Message) == "" {
		if bifrostErr.StatusCode != nil {
			bifrostErr.Error.Message = fmt.Sprintf("aliyun API error (status %d)", *bifrostErr.StatusCode)
		} else {
			bifrostErr.Error.Message = "aliyun API error"
		}
	}

	return bifrostErr
}

func defaultAliyunErrorCode(statusCode int) string {
	switch statusCode {
	case fasthttp.StatusUnauthorized, fasthttp.StatusForbidden:
		return "invalid_api_key"
	case fasthttp.StatusTooManyRequests:
		return "rate_limit_exceeded"
	case fasthttp.StatusInternalServerError, fasthttp.StatusBadGateway, fasthttp.StatusServiceUnavailable, fasthttp.StatusGatewayTimeout:
		return "internal_error"
	default:
		return "provider_error"
	}
}
