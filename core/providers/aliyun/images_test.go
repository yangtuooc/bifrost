package aliyun

import (
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

func TestToAliyunImageGenerationRequest(t *testing.T) {
	size := "1024x768"
	negativePrompt := "low quality"
	n := 2
	seed := 42

	req, err := ToAliyunImageGenerationRequest(&schemas.BifrostImageGenerationRequest{
		Model: "qwen-image-2.0-pro",
		Input: &schemas.ImageGenerationInput{Prompt: "draw a cat"},
		Params: &schemas.ImageGenerationParameters{
			Size:           &size,
			NegativePrompt: &negativePrompt,
			N:              &n,
			Seed:           &seed,
			ExtraParams: map[string]interface{}{
				"prompt_extend": true,
				"watermark":     false,
			},
		},
	})
	if err != nil {
		t.Fatalf("ToAliyunImageGenerationRequest returned error: %v", err)
	}
	if req.Model != "qwen-image-2.0-pro" {
		t.Fatalf("model = %q, want qwen-image-2.0-pro", req.Model)
	}
	if len(req.Input.Messages) != 1 || len(req.Input.Messages[0].Content) != 1 || req.Input.Messages[0].Content[0].Text != "draw a cat" {
		t.Fatalf("unexpected input messages: %#v", req.Input.Messages)
	}
	if req.Parameters["size"] != "1024*768" {
		t.Fatalf("size = %v, want 1024*768", req.Parameters["size"])
	}
	if req.Parameters["negative_prompt"] != "low quality" {
		t.Fatalf("negative_prompt = %v, want low quality", req.Parameters["negative_prompt"])
	}
	if req.Parameters["n"] != 2 || req.Parameters["seed"] != 42 {
		t.Fatalf("n/seed = %v/%v, want 2/42", req.Parameters["n"], req.Parameters["seed"])
	}
	if req.Parameters["prompt_extend"] != true || req.Parameters["watermark"] != false {
		t.Fatalf("extra params were not preserved: %#v", req.Parameters)
	}
}

func TestToBifrostImageGenerationResponse(t *testing.T) {
	source := &AliyunImageGenerationResponse{
		RequestID: "request-1",
		Output: AliyunImageOutput{Choices: []AliyunImageChoice{
			{
				FinishReason: "stop",
				Message: AliyunImageMessage{Content: []AliyunImageContent{
					{Image: "https://example.com/a.png"},
					{Image: "https://example.com/b.png"},
				}},
			},
		}},
		Usage: AliyunImageUsage{Width: 1024, Height: 768, ImageCount: 2},
	}

	resp, bifrostErr := ToBifrostImageGenerationResponse(source, &schemas.BifrostImageGenerationRequest{Model: "qwen-image-2.0-pro"})
	if bifrostErr != nil {
		t.Fatalf("ToBifrostImageGenerationResponse returned error: %v", bifrostErr.Error.Message)
	}
	if resp.ID != "request-1" || resp.Model != "qwen-image-2.0-pro" {
		t.Fatalf("unexpected id/model: %#v", resp)
	}
	if len(resp.Data) != 2 || resp.Data[0].URL != "https://example.com/a.png" || resp.Data[1].Index != 1 {
		t.Fatalf("unexpected image data: %#v", resp.Data)
	}
	if resp.ImageGenerationResponseParameters == nil || resp.ImageGenerationResponseParameters.Size != "1024x768" {
		t.Fatalf("unexpected response params: %#v", resp.ImageGenerationResponseParameters)
	}
	if resp.Usage == nil || resp.Usage.OutputTokensDetails == nil || resp.Usage.OutputTokensDetails.NImages != 2 {
		t.Fatalf("unexpected usage: %#v", resp.Usage)
	}
}

func TestToAliyunImageEditRequest(t *testing.T) {
	size := "1024x1024"
	negativePrompt := "blur"
	req, err := ToAliyunImageEditRequest(&schemas.BifrostImageEditRequest{
		Model: "qwen-image-edit",
		Input: &schemas.ImageEditInput{
			Prompt: "replace the background",
			Images: []schemas.ImageInput{
				{Image: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
			},
		},
		Params: &schemas.ImageEditParameters{
			Size:           &size,
			NegativePrompt: &negativePrompt,
			ExtraParams: map[string]interface{}{
				"watermark": false,
			},
		},
	})
	if err != nil {
		t.Fatalf("ToAliyunImageEditRequest returned error: %v", err)
	}
	if req.Model != "qwen-image-edit" {
		t.Fatalf("model = %q, want qwen-image-edit", req.Model)
	}
	content := req.Input.Messages[0].Content
	if len(content) != 2 {
		t.Fatalf("content length = %d, want 2", len(content))
	}
	if content[0].Image == "" || content[0].Image[:22] != "data:image/png;base64," {
		t.Fatalf("unexpected image data URL: %q", content[0].Image)
	}
	if content[1].Text != "replace the background" {
		t.Fatalf("prompt = %q, want replace the background", content[1].Text)
	}
	if req.Parameters["size"] != "1024*1024" || req.Parameters["negative_prompt"] != "blur" || req.Parameters["watermark"] != false {
		t.Fatalf("unexpected parameters: %#v", req.Parameters)
	}
}

func TestParseAliyunErrorDefaults(t *testing.T) {
	var resp fasthttp.Response
	resp.SetStatusCode(fasthttp.StatusTooManyRequests)
	resp.SetBodyString(`{"message":"too many requests","request_id":"request-err"}`)

	bifrostErr := parseAliyunError(&resp)
	if bifrostErr.StatusCode == nil || *bifrostErr.StatusCode != fasthttp.StatusTooManyRequests {
		t.Fatalf("status code = %#v, want 429", bifrostErr.StatusCode)
	}
	if bifrostErr.Error == nil || bifrostErr.Error.Code == nil || *bifrostErr.Error.Code != "rate_limit_exceeded" {
		t.Fatalf("error code = %#v, want rate_limit_exceeded", bifrostErr.Error)
	}
	if bifrostErr.Error.Message != "too many requests" {
		t.Fatalf("message = %q, want too many requests", bifrostErr.Error.Message)
	}
	if bifrostErr.EventID == nil || *bifrostErr.EventID != "request-err" {
		t.Fatalf("event id = %#v, want request-err", bifrostErr.EventID)
	}
}
