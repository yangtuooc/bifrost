package aliyun

import (
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
)

func TestToAliyunVideoGenerationRequest(t *testing.T) {
	seconds := "5"
	negativePrompt := "low quality"
	audioURL := "https://example.com/audio.mp3"
	imageURL := "https://example.com/image.png"
	seed := 42

	req, err := ToAliyunVideoGenerationRequest(&schemas.BifrostVideoGenerationRequest{
		Model: "wan2.7-t2v",
		Input: &schemas.VideoGenerationInput{
			Prompt:         "make a product video",
			InputReference: &imageURL,
		},
		Params: &schemas.VideoGenerationParameters{
			Seconds:        &seconds,
			Size:           "720p",
			NegativePrompt: &negativePrompt,
			Seed:           &seed,
			ExtraParams: map[string]any{
				"audio_url":     audioURL,
				"prompt_extend": true,
			},
		},
	})
	if err != nil {
		t.Fatalf("ToAliyunVideoGenerationRequest returned error: %v", err)
	}
	if req.Model != "wan2.7-t2v" || req.Input.Prompt != "make a product video" {
		t.Fatalf("unexpected model/input: %#v", req)
	}
	if req.Input.ImageURL != imageURL || req.Input.AudioURL != audioURL || req.Input.NegativePrompt != negativePrompt {
		t.Fatalf("unexpected input urls/prompts: %#v", req.Input)
	}
	if req.Parameters["duration"] != 5 || req.Parameters["resolution"] != "720P" || req.Parameters["seed"] != 42 || req.Parameters["prompt_extend"] != true {
		t.Fatalf("unexpected parameters: %#v", req.Parameters)
	}
	if _, ok := req.Parameters["audio_url"]; ok {
		t.Fatalf("audio_url should be moved into input, got parameters: %#v", req.Parameters)
	}
}

func TestAliyunVideoTaskToBifrostVideoResponse(t *testing.T) {
	task := AliyunVideoTaskResponse{
		Output: AliyunVideoOutput{
			TaskID:              "task-1",
			TaskStatus:          "SUCCEEDED",
			VideoURL:            "https://example.com/video.mp4",
			SubmitTime:          "123",
			EndTime:             "456",
			OutputVideoDuration: 5,
		},
	}

	resp := task.toBifrostVideoResponse("wan2.7-t2v", "prompt")
	if resp.ID != "task-1" || resp.Status != schemas.VideoStatusCompleted || resp.CreatedAt != 123 || resp.CompletedAt == nil || *resp.CompletedAt != 456 {
		t.Fatalf("unexpected response metadata: %#v", resp)
	}
	if len(resp.Videos) != 1 || resp.Videos[0].URL == nil || *resp.Videos[0].URL != "https://example.com/video.mp4" {
		t.Fatalf("unexpected videos: %#v", resp.Videos)
	}
	if resp.Seconds == nil || *resp.Seconds != "5" {
		t.Fatalf("unexpected seconds: %#v", resp.Seconds)
	}
}

func TestAliyunVideoFailedTaskMapsToResponseError(t *testing.T) {
	task := AliyunVideoTaskResponse{
		Output: AliyunVideoOutput{
			TaskID:     "task-failed",
			TaskStatus: "FAILED",
			Code:       "InvalidPrompt",
			Message:    "prompt rejected",
		},
	}

	if err := task.bifrostError(); err != nil {
		t.Fatalf("failed task status should be represented in response, got error: %#v", err)
	}

	resp := task.toBifrostVideoResponse("wan2.7-t2v", "prompt")
	if resp.Status != schemas.VideoStatusFailed {
		t.Fatalf("unexpected status: %s", resp.Status)
	}
	if resp.Error == nil || resp.Error.Code != "InvalidPrompt" || resp.Error.Message != "prompt rejected" {
		t.Fatalf("unexpected response error: %#v", resp.Error)
	}
}
