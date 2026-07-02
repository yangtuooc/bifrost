import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BaseProvider, RequestType } from "@/lib/types/config";
import { isRequestTypeDisabled } from "@/lib/utils/validation";
import { Settings2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Control, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface AllowedRequestsFieldsProps {
	control: Control<any>;
	namePrefix?: string;
	pathOverridesPrefix?: string;
	providerType?: BaseProvider;
	disabled?: boolean;
}

// Provider 专属 endpoint paths。
const ProviderEndpoints: Partial<Record<BaseProvider, Partial<Record<RequestType, string>>>> = {
	openai: {
		list_models: "/v1/models",
		text_completion: "/v1/completions",
		text_completion_stream: "/v1/completions",
		chat_completion: "/v1/chat/completions",
		chat_completion_stream: "/v1/chat/completions",
		responses: "/v1/responses",
		responses_stream: "/v1/responses",
		embedding: "/v1/embeddings",
		speech: "/v1/audio/speech",
		speech_stream: "/v1/audio/speech",
		transcription: "/v1/audio/transcriptions",
		transcription_stream: "/v1/audio/transcriptions",
		image_generation: "/v1/images/generations",
		image_generation_stream: "/v1/images/generations",
		image_edit: "/v1/images/edits",
		image_edit_stream: "/v1/images/edits",
		image_variation: "/v1/images/variations",
		count_tokens: "/v1/responses/tokens",
	},
	anthropic: {
		chat_completion: "/v1/messages",
		chat_completion_stream: "/v1/messages",
		responses: "/v1/messages",
		responses_stream: "/v1/messages",
	},
	cohere: {
		chat_completion: "/v2/chat",
		chat_completion_stream: "/v2/chat",
		responses: "/v2/chat",
		responses_stream: "/v2/chat",
		embedding: "/v2/embed",
	},
};

// 获取当前 Provider 类型对应的 endpoint placeholder。
const getPlaceholder = (providerType: BaseProvider | undefined, requestKey: RequestType): string => {
	if (providerType && ProviderEndpoints[providerType]?.[requestKey]) {
		return ProviderEndpoints[providerType][requestKey]!;
	}
	return ProviderEndpoints["openai"]?.[requestKey] ?? "";
};

const RequestTypes: Array<{ key: RequestType }> = [
	{ key: "list_models" },
	{ key: "text_completion" },
	{ key: "text_completion_stream" },
	{ key: "chat_completion" },
	{ key: "chat_completion_stream" },
	{ key: "responses" },
	{ key: "responses_stream" },
	{ key: "embedding" },
	{ key: "speech" },
	{ key: "speech_stream" },
	{ key: "transcription" },
	{ key: "transcription_stream" },
	{ key: "image_generation" },
	{ key: "image_generation_stream" },
	{ key: "image_edit" },
	{ key: "image_edit_stream" },
	{ key: "image_variation" },
	{ key: "count_tokens" },
];

export function AllowedRequestsFields({
	control,
	namePrefix = "allowed_requests",
	pathOverridesPrefix = "request_path_overrides",
	providerType,
	disabled = false,
}: AllowedRequestsFieldsProps) {
	const { t } = useTranslation();
	const leftColumn = RequestTypes.slice(0, RequestTypes.length / 2);
	const rightColumn = RequestTypes.slice(RequestTypes.length / 2);
	const { getValues, setValue } = useFormContext();

	// Provider 类型变化时重置不支持的 request type 字段。
	useEffect(() => {
		RequestTypes.forEach(({ key }) => {
			const fieldName = `${namePrefix}.${key}`;
			setValue(fieldName, !isRequestTypeDisabled(providerType, key), { shouldDirty: true });
		});
	}, [providerType, namePrefix, setValue, getValues]);

	const isPathOverrideDisabled = useMemo(() => providerType === "gemini" || providerType === "bedrock", [providerType]);

	const renderRequestField = (requestType: { key: RequestType }) => {
		const isDisabled = isRequestTypeDisabled(providerType, requestType.key);
		const placeholder = getPlaceholder(providerType, requestType.key);

		return (
			<FormField
				key={requestType.key}
				control={control}
				name={`${namePrefix}.${requestType.key}`}
				render={({ field: allowedField }) => (
					<FormItem
						className={`flex flex-row items-center justify-between rounded-lg border p-3 ${isDisabled ? "bg-muted/30 opacity-60" : ""}`}
					>
						<div className="space-y-0.5">
							<FormLabel className={isDisabled ? "cursor-not-allowed" : ""}>
								{t(`providers.config.allowedRequests.requestTypes.${requestType.key}`)}
							</FormLabel>
						</div>
						<div className="flex items-center gap-2">
							{/* 仅在启用请求类型时展示 endpoint path 覆盖入口。 */}
							{allowedField.value && !isDisabled && !isPathOverrideDisabled && !disabled && (
								<FormField
									control={control}
									name={`${pathOverridesPrefix}.${requestType.key}`}
									render={({ field: pathField }) => (
										<Popover>
											<PopoverTrigger asChild>
												<button
													type="button"
													className="text-muted-foreground hover:text-foreground transition-colors"
													aria-label={t("providers.config.allowedRequests.customizeAria")}
												>
													<Settings2 className="h-4 w-4" />
												</button>
											</PopoverTrigger>
											<PopoverContent className="w-80" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
												<div className="space-y-2">
													<h4 className="text-sm font-medium">{t("providers.config.allowedRequests.customPathOrUrl")}</h4>
													<p className="text-muted-foreground text-xs">{t("providers.config.allowedRequests.customPathDescription")}</p>
													<Input placeholder={placeholder} {...pathField} value={pathField.value || ""} className="h-9" />
												</div>
											</PopoverContent>
										</Popover>
									)}
								/>
							)}

							<FormControl>
								{isDisabled ? (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<div>
													<Switch checked={isDisabled ? false : allowedField.value} disabled={true} size="md" />
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<p>{t("providers.config.allowedRequests.notSupported", { provider: providerType })}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								) : (
									<Switch checked={allowedField.value} onCheckedChange={allowedField.onChange} size="md" disabled={disabled} />
								)}
							</FormControl>
						</div>
					</FormItem>
				)}
			/>
		);
	};

	return (
		<div className="space-y-4">
			<div>
				<div className="text-sm font-medium">{t("providers.config.allowedRequests.title")}</div>
				<p className="text-muted-foreground text-xs">
					{t("providers.config.allowedRequests.description")}{" "}
					{!isPathOverrideDisabled ? t("providers.config.allowedRequests.customizeHint") : ""}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-3">{leftColumn.map(renderRequestField)}</div>
				<div className="space-y-3">{rightColumn.map(renderRequestField)}</div>
			</div>
		</div>
	);
}