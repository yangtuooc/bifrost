import { getErrorMessage, useAppSelector, useUpdatePluginMutation } from "@/lib/store";
import { MaximConfigSchema, MaximFormSchema } from "@/lib/types/schemas";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MaximFormFragment } from "../../fragments/maximFormFragment";

interface MaximViewProps {
	onDelete?: () => void;
	isDeleting?: boolean;
}

export default function MaximView({ onDelete, isDeleting }: MaximViewProps) {
	const { t } = useTranslation();
	const selectedPlugin = useAppSelector((state) => state.plugin.selectedPlugin);
	const [updatePlugin] = useUpdatePluginMutation();
	const currentConfig = useMemo(
		() => ({ ...((selectedPlugin?.config as MaximConfigSchema) ?? {}), enabled: selectedPlugin?.enabled }),
		[selectedPlugin],
	);

	const handleMaximConfigSave = (config: MaximFormSchema): Promise<void> => {
		return new Promise((resolve, reject) => {
			updatePlugin({
				name: "maxim",
				data: {
					enabled: config.enabled,
					config: config.maxim_config,
				},
			})
				.unwrap()
				.then(() => {
					toast.success(t("observability.maxim.toasts.updated"));
					resolve();
				})
				.catch((err) => {
					toast.error(t("observability.maxim.toasts.updateFailed"), {
						description: getErrorMessage(err),
					});
					reject(err);
				});
		});
	};

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex w-full flex-col gap-2">
				<div className="text-muted-foreground text-xs font-medium">{t("observability.maxim.configuration")}</div>
				<div className="text-muted-foreground mb-2 text-xs font-normal">
					{t("observability.maxim.repoHeaderHint")} <code>x-bf-log-repo-id</code> {t("observability.maxim.repoHeaderSuffix")}
				</div>
				<MaximFormFragment onSave={handleMaximConfigSave} initialConfig={currentConfig} onDelete={onDelete} isDeleting={isDeleting} />
			</div>
		</div>
	);
}