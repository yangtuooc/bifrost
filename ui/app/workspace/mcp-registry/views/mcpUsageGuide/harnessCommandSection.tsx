import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HarnessCommandSectionProps } from "./types";

export function HarnessCommandSection({
	canCopyCommand,
	command,
	controls,
	copySuccessMessage,
	deeplink,
	deeplinkLabel,
	emptyMessage,
	harnessName,
	label,
	logoSrc,
	registrationLabel,
}: HarnessCommandSectionProps) {
	const { t } = useTranslation();
	const labelText = label ?? t("mcpRegistry.usageGuide.command.commandLabel");
	const deeplinkLabelText = deeplinkLabel ?? t("mcpRegistry.usageGuide.command.install");
	const copySuccessMessageText = copySuccessMessage ?? t("mcpRegistry.usageGuide.command.commandCopied");
	const { copy, copied } = useCopyToClipboard({ successMessage: copySuccessMessageText });
	const copyLabel = labelText.toLocaleLowerCase();
	const canUseDeeplink = canCopyCommand && !!deeplink;

	return (
		<section className="flex flex-col gap-2">
			{/* 标题行：标签和操作按钮 */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2 text-sm font-medium">
					<span>{labelText}</span>
				</div>

				<div className="flex items-center gap-2">
					{controls}

					{/* Deeplink 按钮（可选） */}
					{deeplink !== undefined && (
						<Tooltip>
							<TooltipTrigger asChild>
								{canUseDeeplink ? (
									<Button type="button" variant="secondary" size="sm" asChild data-testid="mcp-usage-guide-deeplink">
										<a href={deeplink} aria-label={deeplinkLabelText}>
											{logoSrc && <img src={logoSrc} alt="" aria-hidden="true" className="size-4 rounded-[2px]" />}
											<span>{deeplinkLabelText}</span>
										</a>
									</Button>
								) : (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										disabled
										aria-label={deeplinkLabelText}
										data-testid="mcp-usage-guide-deeplink"
									>
										{logoSrc && <img src={logoSrc} alt="" aria-hidden="true" className="size-4 rounded-[2px]" />}
										<span>{deeplinkLabelText}</span>
									</Button>
								)}
							</TooltipTrigger>
							<TooltipContent>{canUseDeeplink ? deeplinkLabelText : t("mcpRegistry.usageGuide.command.finishSelections")}</TooltipContent>
						</Tooltip>
					)}

					{/* 复制按钮 */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant={copied ? "secondary" : "default"}
								size="sm"
								disabled={!canCopyCommand}
								onClick={() => void copy(command)}
								aria-label={
									copied
										? t("mcpRegistry.usageGuide.command.copiedAria", { label: labelText })
										: t("mcpRegistry.usageGuide.command.copyAria", { label: copyLabel })
								}
								data-testid="mcp-usage-guide-copy-command"
							>
								{copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
								<span>{copied ? t("mcpRegistry.usageGuide.command.copied") : t("mcpRegistry.usageGuide.command.copy")}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{canCopyCommand
								? copied
									? t("mcpRegistry.usageGuide.command.copied")
									: t("mcpRegistry.usageGuide.command.copyAria", { label: copyLabel })
								: t("mcpRegistry.usageGuide.command.finishSelections")}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* 代码块 */}
			<div className="overflow-hidden rounded-sm border bg-[#111827] text-slate-100">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
					<div className="flex items-center gap-2">
						{logoSrc ? (
							<img src={logoSrc} alt="" aria-hidden="true" className="size-4 rounded-[2px]" />
						) : (
							<Terminal className="size-4 text-slate-400" />
						)}
						<span className="text-xs font-medium text-slate-300">{harnessName}</span>
					</div>
					<span className="font-mono text-[11px] text-slate-500">{registrationLabel}</span>
				</div>

				{canCopyCommand ? (
					<pre className="overflow-x-auto p-4 text-xs leading-5">
						<code>{command}</code>
					</pre>
				) : (
					<div className="p-4 text-sm text-slate-400">{emptyMessage}</div>
				)}
			</div>
		</section>
	);
}