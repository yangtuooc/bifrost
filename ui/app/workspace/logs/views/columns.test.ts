import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import type { LogEntry } from "@/lib/types/logs";

import { getMessage } from "./columns";

const testT = ((key: string) => {
	const labels: Record<string, string> = {
		"logs.details.roles.tool": "Tool Result",
		"logs.details.roles.user": "User",
		"logs.details.roles.assistant": "Assistant",
		"logs.details.roles.assistantToolCall": "Assistant Tool Call",
		"logs.details.media.audioFile": "Audio file",
		"logs.details.media.imageFile": "Image file",
	};
	return labels[key] ?? key;
}) as TFunction;

describe("getMessage", () => {
	it("returns EI realtime text from input history", () => {
		const log = {
			object: "realtime.turn",
			input_history: [
				{
					role: "user",
					content: [{ type: "text", text: "hello from the browser" }],
				},
			],
		} as unknown as LogEntry;

		expect(getMessage(log, testT)).toBe("User: hello from the browser");
	});

	it("returns LM realtime text from output message", () => {
		const log = {
			object: "realtime.turn",
			input_history: [],
			responses_input_history: [],
			output_message: {
				role: "assistant",
				content: [{ type: "text", text: "hello from the model" }],
			},
		} as unknown as LogEntry;

		expect(getMessage(log, testT)).toBe("Assistant: hello from the model");
	});

	it("returns split realtime text when both user and assistant are present", () => {
		const log = {
			object: "realtime.turn",
			input_history: [
				{
					role: "user",
					content: [{ type: "text", text: "who are you?" }],
				},
			],
			output_message: {
				role: "assistant",
				content: [{ type: "text", text: "I am the assistant." }],
			},
		} as unknown as LogEntry;

		expect(getMessage(log, testT)).toBe("User: who are you?\nAssistant: I am the assistant.");
	});

	it("returns split realtime text including tool output", () => {
		const log = {
			object: "realtime.turn",
			input_history: [
				{
					role: "tool",
					content: [{ type: "text", text: '{"nextResponse":"tool result"}' }],
				},
				{
					role: "user",
					content: [{ type: "text", text: "who are you?" }],
				},
			],
			output_message: {
				role: "assistant",
				content: [{ type: "text", text: "I am the assistant." }],
			},
		} as unknown as LogEntry;

		expect(getMessage(log, testT)).toBe('Tool Result: {"nextResponse":"tool result"}\nUser: who are you?\nAssistant: I am the assistant.');
	});

	it("returns realtime assistant tool calls from output message", () => {
		const log = {
			object: "realtime.turn",
			input_history: [
				{
					role: "user",
					content: [{ type: "text", text: "show me a pastel palette" }],
				},
			],
			output_message: {
				role: "assistant",
				tool_calls: [
					{
						function: {
							name: "display_color_palette",
							arguments: '{"theme":"pastel"}',
						},
					},
				],
			},
		} as unknown as LogEntry;

		expect(getMessage(log, testT)).toBe('User: show me a pastel palette\nAssistant Tool Call: display_color_palette({"theme":"pastel"})');
	});
});