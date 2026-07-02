package aliyun

import (
	"encoding/base64"
	"testing"

	"github.com/maximhq/bifrost/core/schemas"
)

func TestToAliyunSpeechRequest(t *testing.T) {
	voice := "Cherry"
	languageType := "Chinese"
	speed := 1.1

	req, err := ToAliyunSpeechRequest(&schemas.BifrostSpeechRequest{
		Model: "qwen3-tts-flash",
		Input: &schemas.SpeechInput{Input: "hello"},
		Params: &schemas.SpeechParameters{
			VoiceConfig:  &schemas.SpeechVoiceInput{Voice: &voice},
			LanguageCode: &languageType,
			Instructions: "warm voice",
			Speed:        &speed,
			ExtraParams: map[string]interface{}{
				"optimize_instructions": true,
			},
		},
	})
	if err != nil {
		t.Fatalf("ToAliyunSpeechRequest returned error: %v", err)
	}
	if req.Model != "qwen3-tts-flash" || req.Input.Text != "hello" || req.Input.Voice != "Cherry" || req.Input.LanguageType != "Chinese" {
		t.Fatalf("unexpected request input: %#v", req)
	}
	if req.Parameters["instructions"] != "warm voice" || req.Parameters["speed"] != speed || req.Parameters["optimize_instructions"] != true {
		t.Fatalf("unexpected parameters: %#v", req.Parameters)
	}
}

func TestAliyunSpeechStreamResponse(t *testing.T) {
	audioData := base64.StdEncoding.EncodeToString([]byte("audio"))
	resp := AliyunSpeechResponse{
		Output: AliyunSpeechOutput{
			Audio: AliyunSpeechAudio{Data: audioData},
		},
	}

	streamResp, err := resp.toBifrostSpeechStreamResponse(&schemas.BifrostSpeechRequest{
		Input: &schemas.SpeechInput{Input: "hello"},
	})
	if err != nil {
		t.Fatalf("toBifrostSpeechStreamResponse returned error: %v", err)
	}
	if streamResp == nil || streamResp.Type != schemas.SpeechStreamResponseTypeDelta || string(streamResp.Audio) != "audio" {
		t.Fatalf("unexpected stream response: %#v", streamResp)
	}

	doneResp, err := (AliyunSpeechResponse{
		Output: AliyunSpeechOutput{FinishReason: "stop"},
		Usage:  AliyunSpeechUsage{InputTokens: 1, OutputTokens: 2, TotalTokens: 3},
	}).toBifrostSpeechStreamResponse(&schemas.BifrostSpeechRequest{
		Input: &schemas.SpeechInput{Input: "hello"},
	})
	if err != nil {
		t.Fatalf("done response conversion returned error: %v", err)
	}
	if doneResp == nil || doneResp.Type != schemas.SpeechStreamResponseTypeDone || doneResp.Usage == nil || doneResp.Usage.TotalTokens != 3 {
		t.Fatalf("unexpected done response: %#v", doneResp)
	}
}
