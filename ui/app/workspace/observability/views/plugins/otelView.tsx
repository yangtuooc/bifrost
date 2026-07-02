import { Button } from "@/components/ui/button";
import { getErrorMessage, useAppSelector, useUpdatePluginMutation } from "@/lib/store";
import { OtelFormSchema } from "@/lib/types/schemas";
import { toHeaderStringMap } from "@/lib/utils/secretVarForm";
import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { OtelFormFragment } from "../../fragments/otelFormFragment";
import PluginTracingSheet from "../../sheets/pluginTracingSheet";

interface OtelViewProps {
	onDelete?: () => void;
	isDeleting?: boolean;
}

export default function OtelView({ onDelete, isDeleting }: OtelViewProps) {
	const { t } = useTranslation();
	const selectedPlugin = useAppSelector((state) => state.plugin.selectedPlugin);
	const currentConfig = useMemo(() => ({ config: selectedPlugin?.config, enabled: selectedPlugin?.enabled }), [selectedPlugin]);
	const [updatePlugin] = useUpdatePluginMutation();
	const [isTracingSheetOpen, setIsTracingSheetOpen] = useState(false);

	const handleOtelConfigSave = (config: OtelFormSchema): Promise<void> => {
		// 后端将 headers 存为普通 "env.VAR"/literal 字符串 map，因此这里展开 SecretVar 表单值。
		const profiles = config.profiles.map((profile) => ({
			...profile,
			headers: toHeaderStringMap(profile.headers),
		}));

		return new Promise((resolve, reject) => {
			updatePlugin({
				name: "otel",
				data: {
					enabled: config.enabled,
					config: { profiles },
				},
			})
				.unwrap()
				.then(() => {
					resolve();
					toast.success(t("observability.otel.toasts.updated"));
				})
				.catch((err) => {
					toast.error(t("observability.otel.toasts.updateFailed"), {
						description: getErrorMessage(err),
					});
					reject(err);
				});
		});
	};

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex w-full flex-col gap-3">
				<div className="flex justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setIsTracingSheetOpen(true)}
						data-testid="otel-configure-tracing-button"
					>
						<Activity className="h-4 w-4" />
						{t("observability.pluginTracing.title")}
					</Button>
				</div>
				<OtelFormFragment onSave={handleOtelConfigSave} currentConfig={currentConfig} onDelete={onDelete} isDeleting={isDeleting} />
			</div>
			<PluginTracingSheet
				open={isTracingSheetOpen}
				onClose={() => setIsTracingSheetOpen(false)}
				pluginName="otel"
				destination={t("observability.otel.destination")}
			/>
		</div>
	);
}