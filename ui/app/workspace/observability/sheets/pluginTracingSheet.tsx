import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { TriStateCheckbox } from "@/components/ui/tristateCheckbox";
import { getErrorMessage, useGetLoadedPluginsQuery, useGetPluginQuery, useUpdatePluginMutation } from "@/lib/store";
import { PluginSpanFilter } from "@/lib/types/config";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface PluginTracingSheetProps {
	open: boolean;
	onClose: () => void;
	/**
	 * 正在编辑 span filter 的 observability connector 后端 plugin name（如 "otel"、"datadog"、"bigquery"）。
	 * Sheet 只读写该 plugin 的 `plugin_span_filter`，后端会将它合并到 connector config。
	 */
	pluginName: string;
	/** 展示用目标名称，如 "the OTEL collector"、"Datadog"。 */
	destination: string;
}

function resolveToggleState(filter: PluginSpanFilter | null | undefined, allPlugins: string[]): Record<string, boolean> {
	const state: Record<string, boolean> = {};
	for (const name of allPlugins) {
		state[name] = true;
	}
	if (!filter) return state;

	if (filter.mode === "exclude") {
		for (const name of filter.plugins) {
			state[name] = false;
		}
	} else {
		for (const name of allPlugins) {
			state[name] = filter.plugins.includes(name);
		}
	}
	return state;
}

function buildFilter(toggles: Record<string, boolean>): PluginSpanFilter | null {
	const excluded = Object.entries(toggles)
		.filter(([, on]) => !on)
		.map(([name]) => name);
	if (excluded.length === 0) return null;
	return { mode: "exclude", plugins: excluded };
}

function PluginRow({ name, checked, onChange }: { name: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-center justify-between rounded-md border px-3 py-2.5">
			<span className="font-mono text-sm">{name}</span>
			<div className="flex items-center gap-2">
				<Switch checked={checked} onCheckedChange={onChange} data-testid={`plugin-tracing-toggle-${name}`} />
			</div>
		</div>
	);
}

export default function PluginTracingSheet({ open, onClose, pluginName, destination }: PluginTracingSheetProps) {
	const { t } = useTranslation();
	// 当前所有可发出 spans 的已加载 plugins，名称与 connector 的 span filter 对齐。
	const { data: allPlugins = [], isLoading: isLoadingLoadedPlugins } = useGetLoadedPluginsQuery();
	const { data: targetPlugin } = useGetPluginQuery(pluginName);
	const [updatePlugin, { isLoading }] = useUpdatePluginMutation();
	const [toggles, setToggles] = useState<Record<string, boolean>>({});
	const wasOpenRef = useRef(false);

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			if (!targetPlugin) return; // 等待持久化配置可用。
			const filter = (targetPlugin.config?.plugin_span_filter as PluginSpanFilter | undefined) ?? null;
			if (isLoadingLoadedPlugins || allPlugins.length === 0) return;
			setToggles(resolveToggleState(filter, allPlugins));
			wasOpenRef.current = true;
		}
		if (!open) wasOpenRef.current = false;
	}, [open, targetPlugin, allPlugins, isLoadingLoadedPlugins]);

	const setToggle = useCallback((name: string, value: boolean) => {
		setToggles((prev) => ({ ...prev, [name]: value }));
	}, []);

	const handleSave = useCallback(async () => {
		if (!wasOpenRef.current) {
			// toggles 尚未从持久化配置初始化，阻止保存以避免写入空 filter 覆盖旧配置。
			toast.error(t("observability.pluginTracing.toasts.pluginsLoading"));
			return;
		}
		if (!targetPlugin) {
			toast.error(t("observability.pluginTracing.toasts.notConfigured", { destination }));
			return;
		}
		const filter = buildFilter(toggles);
		try {
			await updatePlugin({
				name: pluginName,
				data: {
					enabled: targetPlugin.enabled,
					config: { plugin_span_filter: filter },
				},
			}).unwrap();
			toast.success(t("observability.pluginTracing.toasts.saved"));
			onClose();
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	}, [toggles, targetPlugin, updatePlugin, onClose, pluginName, destination, t]);

	return (
		<Sheet open={open} onOpenChange={onClose}>
			<SheetContent className="flex w-full flex-col overflow-hidden p-8">
				<SheetHeader className="flex flex-col items-start p-0">
					<SheetTitle>{t("observability.pluginTracing.title")}</SheetTitle>
					<SheetDescription>{t("observability.pluginTracing.description", { destination })}</SheetDescription>
				</SheetHeader>

				<div className="mt-4 flex-1 overflow-y-auto">
					<div className="flex flex-col gap-4">
						<div>
							<div className="mb-2 flex items-center justify-between">
								<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
									{t("observability.pluginTracing.plugins")}
								</p>
								<TriStateCheckbox
									allIds={allPlugins}
									selectedIds={allPlugins.filter((n) => toggles[n] ?? true)}
									onChange={(next) => {
										const nextSet = new Set(next);
										setToggles((prev) => {
											const updated = { ...prev };
											for (const n of allPlugins) updated[n] = nextSet.has(n);
											return updated;
										});
									}}
									ariaLabel={t("observability.pluginTracing.toggleAllAria")}
									data-testid="plugin-tracing-select-all"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								{allPlugins.map((name) => (
									<PluginRow key={name} name={name} checked={toggles[name] ?? true} onChange={(v) => setToggle(name, v)} />
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2 pt-4">
					<Alert variant="info">
						<AlertDescription>
							<span>
								{t("observability.pluginTracing.configPrecedenceStart")} <strong className="inline">plugin_span_filter</strong>{" "}
								{t("observability.pluginTracing.configPrecedenceMiddle")} <strong className="inline">{pluginName}</strong>{" "}
								{t("observability.pluginTracing.configPrecedenceEnd")}
							</span>
						</AlertDescription>
					</Alert>
					<div className="flex justify-end gap-2 pt-2">
						<Button type="button" variant="outline" onClick={onClose} disabled={isLoading} data-testid="plugin-tracing-cancel-button">
							{t("common.actions.cancel")}
						</Button>
						<Button
							onClick={handleSave}
							disabled={isLoading || !wasOpenRef.current}
							isLoading={isLoading}
							data-testid="plugin-tracing-save-button"
							type="button"
						>
							{t("common.actions.save")}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}