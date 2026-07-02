package volcengine

import (
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
)

func TestToVolcengineVideoGenerationRequest(t *testing.T) {
	seconds := "5"
	seed := 42
	audio := true
	imageURL := "https://example.com/input.png"

	req, err := ToVolcengineVideoGenerationRequest(&schemas.BifrostVideoGenerationRequest{
		Model: "doubao-seedance",
		Input: &schemas.VideoGenerationInput{
			Prompt:         "make a short product video",
			InputReference: &imageURL,
		},
		Params: &schemas.VideoGenerationParameters{
			Seconds: &seconds,
			Size:    "720p",
			Seed:    &seed,
			Audio:   &audio,
			ExtraParams: map[string]any{
				"ratio": "16:9",
			},
		},
	})
	if err != nil {
		t.Fatalf("ToVolcengineVideoGenerationRequest returned error: %v", err)
	}
	if req["model"] != "doubao-seedance" {
		t.Fatalf("model = %v, want doubao-seedance", req["model"])
	}
	content, ok := req["content"].([]map[string]interface{})
	if !ok || len(content) != 2 {
		t.Fatalf("unexpected content: %#v", req["content"])
	}
	if content[0]["text"] != "make a short product video" {
		t.Fatalf("text content = %v", content[0]["text"])
	}
	imageContent, _ := content[1]["image_url"].(map[string]string)
	if imageContent["url"] != imageURL {
		t.Fatalf("image url = %v, want %s", imageContent["url"], imageURL)
	}
	if req["duration"] != 5 || req["resolution"] != "720p" || req["seed"] != 42 || req["generate_audio"] != true || req["ratio"] != "16:9" {
		t.Fatalf("unexpected params: %#v", req)
	}
}

func TestVolcengineVideoTaskToBifrostVideoResponse(t *testing.T) {
	progress := 100.0
	task := VolcengineVideoTaskResponse{
		Data: &VolcengineVideoTaskResponse{
			ID:        "video-test",
			Object:    "video",
			Model:     "doubao-seedance",
			Status:    "succeeded",
			CreatedAt: 123,
			UpdatedAt: 456,
			Progress:  &progress,
			Content:   &VolcengineVideoTaskContent{VideoURL: "https://example.com/video.mp4"},
		},
	}

	resp := task.toBifrostVideoResponse("", "prompt")
	if resp.ID != "video-test" || resp.Status != schemas.VideoStatusCompleted || resp.CompletedAt == nil || *resp.CompletedAt != 456 {
		t.Fatalf("unexpected response metadata: %#v", resp)
	}
	if len(resp.Videos) != 1 || resp.Videos[0].URL == nil || *resp.Videos[0].URL != "https://example.com/video.mp4" {
		t.Fatalf("unexpected videos: %#v", resp.Videos)
	}
}
