import { ExternalLink, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BifrostVideoDownloadOutput, BifrostVideoGenerationOutput, BifrostVideoListOutput } from "@/lib/types/logs";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import CollapsibleBox from "./collapsibleBox";
import { CodeEditor } from "@/components/ui/codeEditor";

interface VideoGenerationInput {
	prompt: string;
}

type VideoOutput = BifrostVideoGenerationOutput | BifrostVideoDownloadOutput;

interface VideoViewProps {
	videoInput?: VideoGenerationInput;
	videoOutput?: VideoOutput;
	videoListOutput?: BifrostVideoListOutput;
	requestType?: string;
}

function getMethodTypeLabel(requestType: string | undefined, t: TFunction): string {
	if (!requestType) return t("logs.details.requestTypes.video");
	const normalized = requestType.toLowerCase();
	if (normalized.includes("video_download")) return t("logs.details.requestTypes.videoDownload");
	if (normalized.includes("video_retrieve")) return t("logs.details.requestTypes.videoRetrieve");
	if (normalized.includes("video_generation")) return t("logs.details.requestTypes.videoGeneration");
	if (normalized.includes("video_list")) return t("logs.details.requestTypes.videoList");
	return t("logs.details.requestTypes.video");
}

export default function VideoView({ videoInput, videoOutput, videoListOutput, requestType }: VideoViewProps) {
	const { t } = useTranslation();
	const methodTypeLabel = getMethodTypeLabel(requestType, t);
	const isDownload = requestType?.toLowerCase().includes("video_download");
	const downloadOutput = isDownload && videoOutput ? (videoOutput as BifrostVideoDownloadOutput) : null;
	const generationOutput = !isDownload && videoOutput ? (videoOutput as BifrostVideoGenerationOutput) : null;
	const outputURL = generationOutput?.videos?.[0]?.url;

	return (
		<div className="space-y-4">
			{videoInput && (
				<div className="w-full rounded-sm border">
					<div className="flex items-center gap-2 border-b px-6 py-2 text-sm font-medium">
						<Video className="h-4 w-4" />
						{t("logs.details.sections.inputWithType", { type: methodTypeLabel })}
					</div>
					<div className="space-y-2 p-6">
						<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.prompt")}</div>
						<div className="font-mono text-xs">{videoInput.prompt}</div>
					</div>
				</div>
			)}

			{videoOutput && (
				<div className="w-full rounded-sm border">
					<div className="flex items-center gap-2 border-b px-6 py-2 text-sm font-medium">
						<Video className="h-4 w-4" />
						{t("logs.details.sections.outputWithType", { type: methodTypeLabel })}
					</div>
					<div className="space-y-3 p-6">
						{downloadOutput ? (
							<>
								<div className="grid grid-cols-3 gap-3">
									{downloadOutput.video_id && (
										<div className="space-y-1">
											<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.videoId")}</div>
											<div className="font-mono text-xs break-all">{downloadOutput.video_id}</div>
										</div>
									)}
									{downloadOutput.content_type && (
										<div className="space-y-1">
											<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.contentType")}</div>
											<div className="font-mono text-xs">{downloadOutput.content_type}</div>
										</div>
									)}
								</div>
								<p className="text-muted-foreground text-xs">{t("logs.details.media.videoDownloadNotStored")}</p>
							</>
						) : generationOutput ? (
							<>
								<div className="grid grid-cols-3 gap-3">
									{generationOutput.status && (
										<div className="space-y-1">
											<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.status")}</div>
											<Badge variant="secondary" className="uppercase">
												{generationOutput.status}
											</Badge>
										</div>
									)}
									{generationOutput.progress !== undefined && (
										<div className="space-y-1">
											<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.progress")}</div>
											<div className="font-mono text-xs">{generationOutput.progress}%</div>
										</div>
									)}
									{generationOutput.id && (
										<div className="space-y-1">
											<div className="text-muted-foreground text-xs font-medium">{t("logs.details.labels.videoId")}</div>
											<div className="font-mono text-xs break-all">{generationOutput.id}</div>
										</div>
									)}
								</div>

								{generationOutput.error && (generationOutput.error.message || generationOutput.error.code) && (
									<div className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
										<div className="space-y-1">
											<div className="text-muted-foreground font-medium">{t("logs.details.labels.providerError")}</div>
											{generationOutput.error.code && <div className="font-medium">{generationOutput.error.code}</div>}
											{generationOutput.error.message && <div className="text-muted-foreground">{generationOutput.error.message}</div>}
										</div>
									</div>
								)}

								{outputURL && (
									<div className="space-y-2">
										<video className="w-full rounded-sm border bg-black" controls preload="metadata" src={outputURL}>
											<track kind="captions" />
										</video>
										<a
											href={outputURL}
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary inline-flex items-center gap-1 text-xs underline"
										>
											{t("logs.details.actions.openVideoUrl")}
											<ExternalLink className="h-3 w-3" />
										</a>
									</div>
								)}
							</>
						) : null}
					</div>
				</div>
			)}

			{videoListOutput && (
				<CollapsibleBox
					title={t("logs.details.sections.videoListOutput", { count: videoListOutput.data?.length ?? 0 })}
					onCopy={() => JSON.stringify(videoListOutput, null, 2)}
				>
					<CodeEditor
						className="z-0 w-full"
						shouldAdjustInitialHeight={true}
						maxHeight={450}
						wrap={true}
						code={JSON.stringify(videoListOutput.data, null, 2)}
						lang="json"
						readonly={true}
						options={{ scrollBeyondLastLine: false, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
					/>
				</CollapsibleBox>
			)}
		</div>
	);
}