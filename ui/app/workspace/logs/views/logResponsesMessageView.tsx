import { CodeEditor } from "@/components/ui/codeEditor";
import { ResponsesMessage, ResponsesMessageContentBlock } from "@/lib/types/logs";
import { cleanJson, isJson } from "@/lib/utils/validation";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import CollapsibleBox from "./collapsibleBox";

interface LogResponsesMessageViewProps {
	messages: ResponsesMessage[];
}

function ContentBlockView({ block }: { block: ResponsesMessageContentBlock; index: number }) {
	const { t } = useTranslation();

	const getBlockTitle = (type: string) => {
		switch (type) {
			case "input_text":
				return t("logs.details.messageBlocks.inputText");
			case "input_image":
				return t("logs.details.messageBlocks.inputImage");
			case "input_file":
				return t("logs.details.messageBlocks.inputFile");
			case "input_audio":
				return t("logs.details.messageBlocks.inputAudio");
			case "output_text":
				return t("logs.details.messageBlocks.outputText");
			case "reasoning_text":
				return t("logs.details.messageBlocks.reasoningText");
			case "refusal":
				return t("logs.details.labels.refusal");
			default:
				return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
		}
	};

	const blockTitle = getBlockTitle(block.type);

	// 处理文本内容
	if (block.text) {
		if (isJson(block.text)) {
			const jsonContent = JSON.stringify(cleanJson(block.text), null, 2);
			return (
				<CollapsibleBox title={blockTitle} onCopy={() => jsonContent} collapsedHeight={100}>
					<CodeEditor
						className="z-0 w-full"
						shouldAdjustInitialHeight={true}
						maxHeight={200}
						wrap={true}
						code={jsonContent}
						lang="json"
						readonly={true}
						options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
					/>
				</CollapsibleBox>
			);
		}
		return (
			<CollapsibleBox title={blockTitle} onCopy={() => block.text || ""} collapsedHeight={100}>
				<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs whitespace-pre-wrap">{block.text}</div>
			</CollapsibleBox>
		);
	}

	// 处理图片内容
	if (block.image_url) {
		const jsonContent = JSON.stringify(
			{
				image_url: block.image_url,
				...(block.detail && { detail: block.detail }),
			},
			null,
			2,
		);
		return (
			<CollapsibleBox title={blockTitle} onCopy={() => jsonContent} collapsedHeight={100}>
				<CodeEditor
					className="z-0 w-full"
					shouldAdjustInitialHeight={true}
					maxHeight={150}
					wrap={true}
					code={jsonContent}
					lang="json"
					readonly={true}
					options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
				/>
			</CollapsibleBox>
		);
	}

	// 处理文件内容
	if (block.file_id || block.file_data || block.file_url) {
		const jsonContent = JSON.stringify(
			{
				...(block.filename && { filename: block.filename }),
				...(block.file_id && { file_id: block.file_id }),
				...(block.file_url && { file_url: block.file_url }),
				...(block.file_data && { file_data: "[Base64 encoded data]" }),
			},
			null,
			2,
		);
		return (
			<CollapsibleBox title={blockTitle} onCopy={() => jsonContent} collapsedHeight={100}>
				<CodeEditor
					className="z-0 w-full"
					shouldAdjustInitialHeight={true}
					maxHeight={150}
					wrap={true}
					code={jsonContent}
					lang="json"
					readonly={true}
					options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
				/>
			</CollapsibleBox>
		);
	}

	// 处理音频内容
	if (block.input_audio) {
		const jsonContent = JSON.stringify(block.input_audio, null, 2);
		return (
			<CollapsibleBox title={blockTitle} onCopy={() => jsonContent} collapsedHeight={100}>
				<CodeEditor
					className="z-0 w-full"
					shouldAdjustInitialHeight={true}
					maxHeight={150}
					wrap={true}
					code={jsonContent}
					lang="json"
					readonly={true}
					options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
				/>
			</CollapsibleBox>
		);
	}

	// 处理拒答内容
	if (block.refusal) {
		return (
			<CollapsibleBox title={blockTitle} onCopy={() => block.refusal || ""} collapsedHeight={100}>
				<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs text-red-800">{block.refusal}</div>
			</CollapsibleBox>
		);
	}

	// 处理注释信息
	if (block.annotations && block.annotations.length > 0) {
		const jsonContent = JSON.stringify(block.annotations, null, 2);
		return (
			<CollapsibleBox title={t("logs.details.labels.annotations")} onCopy={() => jsonContent} collapsedHeight={100}>
				<CodeEditor
					className="z-0 w-full"
					shouldAdjustInitialHeight={true}
					maxHeight={150}
					wrap={true}
					code={jsonContent}
					lang="json"
					readonly={true}
					options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
				/>
			</CollapsibleBox>
		);
	}

	// 处理 log probabilities
	if (block.logprobs && block.logprobs.length > 0) {
		const jsonContent = JSON.stringify(block.logprobs, null, 2);
		return (
			<CollapsibleBox title={t("logs.details.labels.logProbabilities")} onCopy={() => jsonContent} collapsedHeight={100}>
				<CodeEditor
					className="z-0 w-full"
					shouldAdjustInitialHeight={true}
					maxHeight={150}
					wrap={true}
					code={jsonContent}
					lang="json"
					readonly={true}
					options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
				/>
			</CollapsibleBox>
		);
	}

	return null;
}

function formatMessageRole(role: string | undefined, t: TFunction) {
	if (!role) return t("logs.details.messageBlocks.message");
	const label = t(`logs.details.roles.${role}`, { defaultValue: role });
	return t("logs.details.messageBlocks.roleMessage", { role: label });
}

function MessageView({ message, index }: { message: ResponsesMessage; index: number }) {
	const { t } = useTranslation();

	const getMessageTitle = () => {
		if (message.type) {
			switch (message.type) {
				case "reasoning":
					return t("logs.details.labels.reasoning");
				case "message":
					return formatMessageRole(message.role, t);
				case "function_call":
					return t("logs.details.messageBlocks.functionCall", { name: message.name || t("logs.details.common.unknown") });
				case "function_call_output":
					return message.call_id
						? t("logs.details.messageBlocks.functionCallOutputWithId", { id: message.call_id })
						: t("logs.details.messageBlocks.functionCallOutput");
				case "file_search_call":
					return t("logs.details.messageBlocks.fileSearch");
				case "web_search_call":
					return t("logs.details.messageBlocks.webSearch");
				case "computer_call":
					return t("logs.details.messageBlocks.computerAction");
				case "computer_call_output":
					return t("logs.details.messageBlocks.computerActionOutput");
				case "code_interpreter_call":
					return t("logs.details.messageBlocks.codeInterpreter");
				case "mcp_call":
					return t("logs.details.messageBlocks.mcpToolCall");
				case "custom_tool_call":
					return t("logs.details.messageBlocks.customToolCall");
				case "custom_tool_call_output":
					return t("logs.details.messageBlocks.customToolOutput");
				case "image_generation_call":
					return t("logs.details.requestTypes.imageGeneration");
				case "refusal":
					return t("logs.details.labels.refusal");
				default:
					return message.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
			}
		}
		return message.role ? t(`logs.details.roles.${message.role}`, { defaultValue: message.role }) : t("logs.details.messageBlocks.message");
	};

	if (message.type == "reasoning" && (!message.summary || message.summary.length === 0) && !message.encrypted_content && !message.content) {
		return null;
	}

	const messageTitle = getMessageTitle();

	return (
		<div key={`message-${index}`} className="flex w-full flex-col gap-2">
			{/* 消息标题 */}
			<div className="text-sm font-medium">{messageTitle}</div>

			{/* 处理 reasoning 内容 */}
			{message.type === "reasoning" && message.summary && message.summary.length > 0 && (
				<>
					{message.summary.every((item) => item.type === "summary_text") ? (
						// 全部为 summary_text 时直接展示可读文本
						message.summary.map((reasoningContent, idx) => (
							<CollapsibleBox
								key={idx}
								title={t("logs.details.messageBlocks.summaryNumber", { index: idx + 1 })}
								onCopy={() => reasoningContent.text || ""}
								collapsedHeight={100}
							>
								<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs whitespace-pre-wrap">
									{reasoningContent.text}
								</div>
							</CollapsibleBox>
						))
					) : (
						// 混合或非文本类型回退到 JSON 展示
						<CollapsibleBox
							title={t("logs.details.labels.summary")}
							onCopy={() => JSON.stringify(message.summary, null, 2)}
							collapsedHeight={100}
						>
							<CodeEditor
								className="z-0 w-full"
								shouldAdjustInitialHeight={true}
								maxHeight={300}
								wrap={true}
								code={JSON.stringify(message.summary, null, 2)}
								lang="json"
								readonly={true}
								options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
							/>
						</CollapsibleBox>
					)}
				</>
			)}

			{/* 处理加密 reasoning 内容 */}
			{message.type === "reasoning" && message.encrypted_content && (
				<CollapsibleBox
					title={t("logs.details.messageBlocks.encryptedReasoningContent")}
					onCopy={() => message.encrypted_content || ""}
					collapsedHeight={100}
				>
					<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs break-words whitespace-pre-wrap">
						{message.encrypted_content}
					</div>
				</CollapsibleBox>
			)}

			{/* 处理常规内容 */}
			{message.content && (
				<>
					{typeof message.content === "string" ? (
						<>
							{isJson(message.content) ? (
								<CollapsibleBox
									title={t("logs.details.labels.content")}
									onCopy={() => JSON.stringify(cleanJson(message.content as string), null, 2)}
									collapsedHeight={100}
								>
									<CodeEditor
										className="z-0 w-full"
										shouldAdjustInitialHeight={true}
										maxHeight={250}
										wrap={true}
										code={JSON.stringify(cleanJson(message.content), null, 2)}
										lang="json"
										readonly={true}
										options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
									/>
								</CollapsibleBox>
							) : (
								<CollapsibleBox
									title={t("logs.details.labels.content")}
									onCopy={() => (message.content as string) || ""}
									collapsedHeight={100}
								>
									<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs break-words whitespace-pre-wrap">
										{message.content}
									</div>
								</CollapsibleBox>
							)}
						</>
					) : (
						Array.isArray(message.content) &&
						message.content.map((block, blockIndex) => <ContentBlockView key={blockIndex} block={block} index={blockIndex} />)
					)}
				</>
			)}

			{/* 处理工具调用字段 */}
			{(message.call_id || message.name || message.arguments) && (
				<CollapsibleBox
					title={t("logs.details.sections.toolDetails")}
					onCopy={() =>
						JSON.stringify(
							{
								...(message.call_id && { call_id: message.call_id }),
								...(message.name && { name: message.name }),
								...(message.arguments && { arguments: isJson(message.arguments) ? cleanJson(message.arguments) : message.arguments }),
							},
							null,
							2,
						)
					}
					collapsedHeight={100}
				>
					<CodeEditor
						className="z-0 w-full"
						shouldAdjustInitialHeight={true}
						maxHeight={400}
						wrap={true}
						code={JSON.stringify(
							{
								...(message.call_id && { call_id: message.call_id }),
								...(message.name && { name: message.name }),
								...(message.arguments && { arguments: isJson(message.arguments) ? cleanJson(message.arguments) : message.arguments }),
							},
							null,
							2,
						)}
						lang="json"
						readonly={true}
						options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
					/>
				</CollapsibleBox>
			)}

			{/* 处理函数调用输出 */}
			{message.output !== undefined && (
				<CollapsibleBox
					title={t("logs.details.labels.output")}
					onCopy={() => (typeof message.output === "string" ? message.output : JSON.stringify(message.output, null, 2))}
					collapsedHeight={100}
				>
					{typeof message.output === "string" ? (
						isJson(message.output) ? (
							<CodeEditor
								className="z-0 w-full"
								shouldAdjustInitialHeight={true}
								maxHeight={400}
								wrap={true}
								code={JSON.stringify(cleanJson(message.output), null, 2)}
								lang="json"
								readonly={true}
								options={{ scrollBeyondLastLine: false, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
							/>
						) : (
							<div className="custom-scrollbar max-h-[400px] overflow-y-auto px-6 py-2 font-mono text-xs break-words whitespace-pre-wrap">
								{message.output}
							</div>
						)
					) : (
						<CodeEditor
							className="z-0 w-full"
							shouldAdjustInitialHeight={true}
							maxHeight={400}
							wrap={true}
							code={JSON.stringify(message.output, null, 2)}
							lang="json"
							readonly={true}
							options={{ scrollBeyondLastLine: false, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
						/>
					)}
				</CollapsibleBox>
			)}

			{/* 处理额外工具字段 */}
			{Object.keys(message).some(
				(key) =>
					!["id", "type", "status", "role", "content", "call_id", "name", "arguments", "summary", "encrypted_content", "output"].includes(
						key,
					),
			) && (
				<CollapsibleBox
					title={t("logs.details.sections.additionalFields")}
					onCopy={() =>
						JSON.stringify(
							Object.fromEntries(
								Object.entries(message).filter(
									([key]) =>
										![
											"id",
											"type",
											"status",
											"role",
											"content",
											"call_id",
											"name",
											"arguments",
											"summary",
											"encrypted_content",
											"output",
										].includes(key),
								),
							),
							null,
							2,
						)
					}
					collapsedHeight={100}
				>
					<CodeEditor
						className="z-0 w-full"
						shouldAdjustInitialHeight={true}
						maxHeight={400}
						wrap={true}
						code={JSON.stringify(
							Object.fromEntries(
								Object.entries(message).filter(
									([key]) =>
										![
											"id",
											"type",
											"status",
											"role",
											"content",
											"call_id",
											"name",
											"arguments",
											"summary",
											"encrypted_content",
											"output",
										].includes(key),
								),
							),
							null,
							2,
						)}
						lang="json"
						readonly={true}
						options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
					/>
				</CollapsibleBox>
			)}
		</div>
	);
}

export default function LogResponsesMessageView({ messages }: LogResponsesMessageViewProps) {
	const { t } = useTranslation();

	if (!messages || messages.length === 0) {
		return (
			<div className="w-full rounded-sm border">
				<div className="text-muted-foreground px-6 py-4 text-center text-sm">{t("logs.details.empty.noResponsesMessages")}</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{messages.map((message, index) => (
				<MessageView key={index} message={message} index={index} />
			))}
		</div>
	);
}