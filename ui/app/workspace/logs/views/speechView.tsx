import { BifrostSpeech, SpeechInput } from "@/lib/types/logs";
import { AlertCircle, Play, Volume2 } from "lucide-react";
import React, { Component } from "react";
import { useTranslation } from "react-i18next";
import AudioPlayer from "./audioPlayer";

interface SpeechViewProps {
	speechInput?: SpeechInput;
	speechOutput?: BifrostSpeech;
	isStreaming?: boolean;
}

class AudioErrorBoundary extends Component<
	{ children: React.ReactNode; formatLoadFailed: (message: string) => string; unknownError: string },
	{ hasError: boolean; error: Error | null }
> {
	constructor(props: { children: React.ReactNode; formatLoadFailed: (message: string) => string; unknownError: string }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("Audio player error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800">
					<AlertCircle className="h-4 w-4" />
					<span>{this.props.formatLoadFailed(this.state.error?.message || this.props.unknownError)}</span>
				</div>
			);
		}

		return this.props.children;
	}
}

export default function SpeechView({ speechInput, speechOutput, isStreaming }: SpeechViewProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-4">
			{speechInput && (
				<div className="w-full rounded-sm border">
					<div className="flex items-center gap-2 border-b px-6 py-2 text-sm font-medium">
						<Volume2 className="h-4 w-4" />
						{t("logs.details.labels.speechInput")}
					</div>
					<div className="space-y-4 p-6">
						<div className="font-mono text-xs">{speechInput.input}</div>
					</div>
				</div>
			)}

			{(speechOutput || isStreaming) && (
				<div className="w-full rounded-sm border">
					<div className="flex items-center gap-2 border-b px-6 py-2 text-sm font-medium">
						<Play className="h-4 w-4" />
						{t("logs.details.labels.speechOutput")}
					</div>
					<div className="space-y-4 p-6">
						<AudioErrorBoundary
							formatLoadFailed={(message) => t("logs.details.audioPlayer.loadFailed", { message })}
							unknownError={t("logs.details.audioPlayer.unknownError")}
						>
							<AudioPlayer src={speechOutput?.audio || ""} />
						</AudioErrorBoundary>
					</div>
				</div>
			)}
		</div>
	);
}