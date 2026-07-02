import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage, useGetCoreConfigQuery, useGetDroppedRequestsQuery, useUpdateCoreConfigMutation } from "@/lib/store";
import { CoreConfig, DefaultCoreConfig, DefaultGlobalHeaderFilterConfig, GlobalHeaderFilterConfig } from "@/lib/types/config";
import { cn } from "@/lib/utils";
import LargePayloadSettingsFragment from "@enterprise/components/large-payload/largePayloadSettingsFragment";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useGetLargePayloadConfigQuery, useUpdateLargePayloadConfigMutation } from "@enterprise/lib/store/apis/largePayloadApi";
import { DefaultLargePayloadConfig, LargePayloadConfig } from "@enterprise/lib/types/largePayload";
import { Info, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// Security headers that cannot be configured in allowlist/denylist
// These headers are always blocked for security reasons regardless of configuration
const SECURITY_HEADERS = [
	"proxy-authorization",
	"cookie",
	"host",
	"content-length",
	"connection",
	"transfer-encoding",
	"x-api-key",
	"x-goog-api-key",
	"x-bf-api-key",
	"x-bf-vk",
];

// Helper to check if a header is a security header
function isSecurityHeader(header: string): boolean {
	const h = header.toLowerCase().trim();
	// Wildcard patterns are not literal security headers
	if (h.includes("*")) return false;
	return SECURITY_HEADERS.includes(h);
}

// Helper to compare header filter configs
function headerFilterConfigEqual(a?: GlobalHeaderFilterConfig, b?: GlobalHeaderFilterConfig): boolean {
	const aAllowlist = a?.allowlist || [];
	const bAllowlist = b?.allowlist || [];
	const aDenylist = a?.denylist || [];
	const bDenylist = b?.denylist || [];

	if (aAllowlist.length !== bAllowlist.length || aDenylist.length !== bDenylist.length) {
		return false;
	}

	return aAllowlist.every((v, i) => v === bAllowlist[i]) && aDenylist.every((v, i) => v === bDenylist[i]);
}

// Helper to compare large payload configs
function largePayloadConfigEqual(a: LargePayloadConfig, b: LargePayloadConfig): boolean {
	return (
		a.enabled === b.enabled &&
		a.request_threshold_bytes === b.request_threshold_bytes &&
		a.response_threshold_bytes === b.response_threshold_bytes &&
		a.prefetch_size_bytes === b.prefetch_size_bytes &&
		a.max_payload_bytes === b.max_payload_bytes &&
		a.truncated_log_bytes === b.truncated_log_bytes
	);
}

export default function ClientSettingsView() {
	const { t } = useTranslation();
	const hasSettingsUpdateAccess = useRbac(RbacResource.Settings, RbacOperation.Update);
	const [droppedRequests, setDroppedRequests] = useState<number>(0);
	const { data: droppedRequestsData } = useGetDroppedRequestsQuery();
	const { data: bifrostConfig, isLoading: isCoreConfigLoading } = useGetCoreConfigQuery({ fromDB: true });
	const config = bifrostConfig?.client_config;
	const [updateCoreConfig, { isLoading: isSavingCoreConfig }] = useUpdateCoreConfigMutation();
	const [localConfig, setLocalConfig] = useState<CoreConfig>(DefaultCoreConfig);

	// Large payload config state
	const { data: serverLargePayloadConfig, isLoading: isLargePayloadConfigLoading } = useGetLargePayloadConfigQuery();
	const [updateLargePayloadConfig, { isLoading: isSavingLargePayload }] = useUpdateLargePayloadConfigMutation();
	const [localLargePayloadConfig, setLocalLargePayloadConfig] = useState<LargePayloadConfig>(DefaultLargePayloadConfig);

	const isQueriesLoading = isCoreConfigLoading || isLargePayloadConfigLoading;
	const isLoading = isSavingCoreConfig || isSavingLargePayload;

	useEffect(() => {
		if (droppedRequestsData) {
			setDroppedRequests(droppedRequestsData.dropped_requests);
		}
	}, [droppedRequestsData]);

	useEffect(() => {
		if (config) {
			setLocalConfig({
				...config,
				header_filter_config: config.header_filter_config || DefaultGlobalHeaderFilterConfig,
			});
		}
	}, [config]);

	useEffect(() => {
		if (serverLargePayloadConfig) {
			setLocalLargePayloadConfig(serverLargePayloadConfig);
		}
	}, [serverLargePayloadConfig]);

	const hasCoreConfigChanges = useMemo(() => {
		if (!config) return false;
		return (
			localConfig.drop_excess_requests !== config.drop_excess_requests ||
			localConfig.disable_db_pings_in_health !== config.disable_db_pings_in_health ||
			localConfig.dump_errors_in_console_logs !== config.dump_errors_in_console_logs ||
			localConfig.async_job_result_ttl !== config.async_job_result_ttl ||
			!headerFilterConfigEqual(localConfig.header_filter_config, config.header_filter_config)
		);
	}, [config, localConfig]);

	const hasLargePayloadChanges = useMemo(() => {
		const baseline = serverLargePayloadConfig ?? DefaultLargePayloadConfig;
		return !largePayloadConfigEqual(localLargePayloadConfig, baseline);
	}, [serverLargePayloadConfig, localLargePayloadConfig]);

	const hasChanges = hasCoreConfigChanges || hasLargePayloadChanges;

	// Detect security headers in allowlist/denylist
	const invalidSecurityHeaders = useMemo(() => {
		const allowlist = localConfig.header_filter_config?.allowlist || [];
		const denylist = localConfig.header_filter_config?.denylist || [];
		const invalidInAllowlist = allowlist.filter((h) => h && isSecurityHeader(h));
		const invalidInDenylist = denylist.filter((h) => h && isSecurityHeader(h));
		return [...new Set([...invalidInAllowlist, ...invalidInDenylist])];
	}, [localConfig.header_filter_config]);

	const hasSecurityHeaderError = invalidSecurityHeaders.length > 0;

	const handleConfigChange = useCallback((field: keyof CoreConfig, value: boolean | number | string[] | GlobalHeaderFilterConfig) => {
		setLocalConfig((prev) => ({ ...prev, [field]: value }));
	}, []);

	const handleLargePayloadConfigChange = useCallback((newConfig: LargePayloadConfig) => {
		setLocalLargePayloadConfig(newConfig);
	}, []);

	const handleSave = useCallback(async () => {
		// Defense in depth - don't save if security headers are present
		if (hasSecurityHeaderError) {
			return;
		}

		// Validate large payload config if it has changes
		if (hasLargePayloadChanges) {
			const minBytes = 1024;
			if (
				localLargePayloadConfig.request_threshold_bytes < minBytes ||
				localLargePayloadConfig.response_threshold_bytes < minBytes ||
				localLargePayloadConfig.prefetch_size_bytes < minBytes ||
				localLargePayloadConfig.max_payload_bytes < minBytes ||
				localLargePayloadConfig.truncated_log_bytes < minBytes
			) {
				toast.error(t("config.clientSettings.toasts.minByteValue"));
				return;
			}
			if (localLargePayloadConfig.max_payload_bytes < localLargePayloadConfig.request_threshold_bytes) {
				toast.error(t("config.clientSettings.toasts.maxPayloadBelowRequest"));
				return;
			}
			if (localLargePayloadConfig.max_payload_bytes < localLargePayloadConfig.response_threshold_bytes) {
				toast.error(t("config.clientSettings.toasts.maxPayloadBelowResponse"));
				return;
			}
		}

		let coreConfigSaved = false;
		let largePayloadSaved = false;

		// Save core config if changed
		if (hasCoreConfigChanges) {
			if (!bifrostConfig) {
				toast.error(t("config.clientSettings.toasts.notLoaded"));
				return;
			}
			// Clean up empty strings from header filter config
			const cleanedConfig = {
				...localConfig,
				header_filter_config: {
					allowlist: (localConfig.header_filter_config?.allowlist || []).filter((h) => h && h.trim().length > 0),
					denylist: (localConfig.header_filter_config?.denylist || []).filter((h) => h && h.trim().length > 0),
				},
			};

			try {
				await updateCoreConfig({ ...bifrostConfig!, client_config: cleanedConfig }).unwrap();
				coreConfigSaved = true;
			} catch (error) {
				toast.error(t("config.clientSettings.toasts.saveClientFailed", { message: getErrorMessage(error) }));
			}
		}

		// Save large payload config if changed
		if (hasLargePayloadChanges) {
			try {
				await updateLargePayloadConfig(localLargePayloadConfig).unwrap();
				largePayloadSaved = true;
			} catch (error) {
				toast.error(t("config.clientSettings.toasts.saveLargePayloadFailed", { message: getErrorMessage(error) }));
			}
		}

		if (coreConfigSaved || largePayloadSaved) {
			if (largePayloadSaved) {
				toast.success(t("config.clientSettings.toasts.largePayloadUpdated"));
			} else {
				toast.success(t("config.clientSettings.toasts.updated"));
			}
		}
	}, [
		bifrostConfig,
		hasSecurityHeaderError,
		hasCoreConfigChanges,
		hasLargePayloadChanges,
		localConfig,
		localLargePayloadConfig,
		t,
		updateCoreConfig,
		updateLargePayloadConfig,
	]);

	// Header filter list handlers
	const handleAddAllowlistHeader = useCallback(() => {
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				allowlist: [...(prev.header_filter_config?.allowlist || []), ""],
			},
		}));
	}, []);

	const handleRemoveAllowlistHeader = useCallback((index: number) => {
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				allowlist: (prev.header_filter_config?.allowlist || []).filter((_, i) => i !== index),
			},
		}));
	}, []);

	const handleAllowlistChange = useCallback((index: number, value: string) => {
		const lowerValue = value.toLowerCase();
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				allowlist: (prev.header_filter_config?.allowlist || []).map((h, i) => (i === index ? lowerValue : h)),
			},
		}));
	}, []);

	const handleAddDenylistHeader = useCallback(() => {
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				denylist: [...(prev.header_filter_config?.denylist || []), ""],
			},
		}));
	}, []);

	const handleRemoveDenylistHeader = useCallback((index: number) => {
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				denylist: (prev.header_filter_config?.denylist || []).filter((_, i) => i !== index),
			},
		}));
	}, []);

	const handleDenylistChange = useCallback((index: number, value: string) => {
		const lowerValue = value.toLowerCase();
		setLocalConfig((prev) => ({
			...prev,
			header_filter_config: {
				...prev.header_filter_config,
				denylist: (prev.header_filter_config?.denylist || []).map((h, i) => (i === index ? lowerValue : h)),
			},
		}));
	}, []);

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">{t("config.clientSettings.title")}</h2>
				<p className="text-muted-foreground text-sm">{t("config.clientSettings.description")}</p>
			</div>

			<div className="space-y-4">
				{/* Drop Excess Requests */}
				<div className="flex items-center justify-between space-x-2">
					<div className="space-y-0.5">
						<label htmlFor="drop-excess-requests" className="text-sm font-medium">
							{t("config.clientSettings.dropExcessRequests.label")}
						</label>
						<p className="text-muted-foreground text-sm">
							{t("config.clientSettings.dropExcessRequests.description")}{" "}
							{localConfig.drop_excess_requests && droppedRequests > 0 ? (
								<span>
									{t("config.clientSettings.dropExcessRequests.droppedPrefix")}{" "}
									<b>{t("config.clientSettings.dropExcessRequests.droppedCount", { count: droppedRequests })}</b>{" "}
									{t("config.clientSettings.dropExcessRequests.droppedSuffix")}
								</span>
							) : (
								<></>
							)}
						</p>
					</div>
					<Switch
						id="drop-excess-requests"
						size="md"
						checked={localConfig.drop_excess_requests}
						onCheckedChange={(checked) => handleConfigChange("drop_excess_requests", checked)}
						disabled={!hasSettingsUpdateAccess}
					/>
				</div>

				{/* Disable DB Pings in Health */}
				<div className="flex items-center justify-between space-x-2">
					<div className="space-y-0.5">
						<label htmlFor="disable-db-pings-in-health" className="text-sm font-medium">
							{t("config.clientSettings.disableDbPings.label")}
						</label>
						<p className="text-muted-foreground text-sm">{t("config.clientSettings.disableDbPings.description")}</p>
					</div>
					<Switch
						id="disable-db-pings-in-health"
						size="md"
						checked={localConfig.disable_db_pings_in_health}
						onCheckedChange={(checked) => handleConfigChange("disable_db_pings_in_health", checked)}
						disabled={!hasSettingsUpdateAccess}
					/>
				</div>

				{/* Dump Errors in Console Logs */}
				<div className="flex items-center justify-between space-x-2">
					<div className="space-y-0.5">
						<label htmlFor="dump-errors-in-console-logs" className="text-sm font-medium">
							{t("config.clientSettings.dumpErrors.label")}
						</label>
						<p className="text-muted-foreground text-sm">{t("config.clientSettings.dumpErrors.description")}</p>
					</div>
					<Switch
						id="dump-errors-in-console-logs"
						data-testid="client-settings-dump-errors-switch"
						size="md"
						checked={localConfig.dump_errors_in_console_logs}
						onCheckedChange={(checked) => handleConfigChange("dump_errors_in_console_logs", checked)}
						disabled={!hasSettingsUpdateAccess}
					/>
				</div>
				{/* Async Job Result TTL */}
				<div className="flex items-center justify-between space-x-2">
					<div className="space-y-0.5">
						<label htmlFor="async-job-result-ttl" className="text-sm font-medium">
							{t("config.clientSettings.asyncJobResultTtl.label")}
						</label>
						<p className="text-muted-foreground text-sm">{t("config.clientSettings.asyncJobResultTtl.description")}</p>
					</div>
					<Input
						id="async-job-result-ttl"
						type="number"
						min={1}
						className="w-32"
						value={localConfig.async_job_result_ttl}
						onChange={(e) => handleConfigChange("async_job_result_ttl", parseInt(e.target.value) || 0)}
						disabled={!hasSettingsUpdateAccess}
						data-testid="client-settings-async-job-result-ttl-input"
					/>
				</div>
			</div>

			{/* Header Filter Section */}
			<div className="space-y-4">
				<div>
					<h3 className="text-lg font-semibold tracking-tight">{t("config.clientSettings.headerForwarding.title")}</h3>
					<p className="text-muted-foreground text-sm">{t("config.clientSettings.headerForwarding.description")}</p>
				</div>

				<Accordion type="multiple" className="w-full rounded-sm border px-4">
					<AccordionItem value="about-extra-headers">
						<AccordionTrigger>
							<span className="flex items-center gap-2">
								<Info className="h-4 w-4" />
								{t("config.clientSettings.headerForwarding.aboutTitle")}
							</span>
						</AccordionTrigger>
						<AccordionContent className="space-y-3">
							<div>
								<p className="mb-2 font-medium">{t("config.clientSettings.headerForwarding.about.twoWaysTitle")}</p>
								<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.prefixedHeaders")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.prefixedHeadersDescriptionStart")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">x-bf-eh-*</code> prefix. For example,{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">x-bf-eh-custom-id</code> is forwarded as{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">custom-id</code>.
									</li>
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.directHeaders")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.directHeadersDescription")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">anthropic-beta</code>).
									</li>
								</ul>
							</div>
							<div>
								<p className="mb-2 font-medium">{t("config.clientSettings.headerForwarding.about.listRulesTitle")}</p>
								<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.allowlistEmpty")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.allowlistEmptyDescriptionStart")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">x-bf-eh-*</code>{" "}
										{t("config.clientSettings.headerForwarding.about.allowlistEmptyDescriptionEnd")}
									</li>
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.allowlistConfigured")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.allowlistConfiguredDescription")}
									</li>
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.denylist")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.denylistDescription")}
									</li>
									<li>
										<span className="font-medium">{t("config.clientSettings.headerForwarding.about.wildcards")}</span>{" "}
										{t("config.clientSettings.headerForwarding.about.wildcardsDescriptionStart")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">*</code> at the end of a pattern to match prefixes
										(e.g., <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">anthropic-*</code> matches all headers starting
										with <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">anthropic-</code>). Use{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">*</code> alone to match all headers.
									</li>
								</ul>
							</div>
							<div>
								<p className="mb-2 font-medium">{t("config.clientSettings.headerForwarding.about.importantTitle")}</p>
								<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
									<li>
										{t("config.clientSettings.headerForwarding.about.withoutPrefixStart")} <span className="font-medium">without</span>{" "}
										{t("config.clientSettings.headerForwarding.about.withoutPrefixEnd")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">x-bf-eh-</code> prefix
									</li>
									<li>
										{t("config.clientSettings.headerForwarding.about.exampleStart")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">x-bf-eh-custom-id</code>{" "}
										{t("config.clientSettings.headerForwarding.about.exampleMiddle")}{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">custom-id</code>, add{" "}
										<code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">custom-id</code> to the allowlist
									</li>
								</ul>
							</div>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="security-note">
						<AccordionTrigger>
							<span className="flex items-center gap-2">
								<Info className="h-4 w-4" />
								{t("config.clientSettings.headerForwarding.securityNote")}
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<p className="text-sm">{t("config.clientSettings.headerForwarding.securityDescription")}</p>
							<p className="text-muted-foreground mt-1 font-mono text-xs">
								proxy-authorization, cookie, host, content-length, connection, transfer-encoding, x-api-key, x-goog-api-key, x-bf-api-key,
								x-bf-vk
							</p>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				{/* Allowlist Section */}
				<div className="space-y-3">
					<div className="space-y-1">
						<h4 className="text-sm font-medium">{t("config.clientSettings.headerForwarding.allowlist")}</h4>
						<p className="text-muted-foreground text-xs">
							{t("config.clientSettings.headerForwarding.allowlistDescriptionStart")}{" "}
							<code className="bg-muted rounded px-1 font-mono">x-bf-eh-</code>{" "}
							{t("config.clientSettings.headerForwarding.allowlistDescriptionEnd")}
						</p>
					</div>

					<div className="space-y-2">
						{(localConfig.header_filter_config?.allowlist || []).map((header, index) => (
							<div key={index} className="flex items-center gap-2">
								<Input
									placeholder="e.g. anthropic-*, custom-id"
									data-testid="header-filter-allowlist-input"
									className={cn(
										"font-mono lowercase",
										isSecurityHeader(header) &&
											"border-destructive focus:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50",
									)}
									value={header}
									onChange={(e) => handleAllowlistChange(index, e.target.value)}
									disabled={!hasSettingsUpdateAccess}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => handleRemoveAllowlistHeader(index)}
									className="text-muted-foreground hover:text-destructive"
									disabled={!hasSettingsUpdateAccess}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						))}
						<Button type="button" variant="outline" size="sm" onClick={handleAddAllowlistHeader} disabled={!hasSettingsUpdateAccess}>
							<Plus className="mr-2 h-4 w-4" />
							{t("config.clientSettings.headerForwarding.addHeader")}
						</Button>
					</div>
				</div>

				{/* Denylist Section */}
				<div className="space-y-3">
					<div className="space-y-1">
						<h4 className="text-sm font-medium">{t("config.clientSettings.headerForwarding.denylist")}</h4>
						<p className="text-muted-foreground text-xs">
							{t("config.clientSettings.headerForwarding.denylistDescriptionStart")}{" "}
							<code className="bg-muted rounded px-1 font-mono">x-bf-eh-</code>{" "}
							{t("config.clientSettings.headerForwarding.denylistDescriptionEnd")}
						</p>
					</div>

					<div className="space-y-2">
						{(localConfig.header_filter_config?.denylist || []).map((header, index) => (
							<div key={index} className="flex items-center gap-2">
								<Input
									placeholder="e.g. x-internal-*"
									data-testid="header-filter-denylist-input"
									className={cn(
										"font-mono lowercase",
										isSecurityHeader(header) &&
											"border-destructive focus:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50",
									)}
									value={header}
									onChange={(e) => handleDenylistChange(index, e.target.value)}
									disabled={!hasSettingsUpdateAccess}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => handleRemoveDenylistHeader(index)}
									className="text-muted-foreground hover:text-destructive"
									disabled={!hasSettingsUpdateAccess}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						))}
						<Button type="button" variant="outline" size="sm" onClick={handleAddDenylistHeader} disabled={!hasSettingsUpdateAccess}>
							<Plus className="mr-2 h-4 w-4" />
							{t("config.clientSettings.headerForwarding.addHeader")}
						</Button>
					</div>
				</div>
			</div>

			{/* Large Payload Optimization - Enterprise only */}
			<LargePayloadSettingsFragment
				config={localLargePayloadConfig}
				onConfigChange={handleLargePayloadConfigChange}
				controlsDisabled={isLoading || !hasSettingsUpdateAccess}
			/>

			<div className="flex justify-end pt-2">
				{hasSecurityHeaderError ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button disabled>{isLoading ? t("common.actions.saving") : t("common.actions.saveChanges")}</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>
							{t("config.clientSettings.headerForwarding.removeSecurityHeaders", { count: invalidSecurityHeaders.length })}:{" "}
							{invalidSecurityHeaders.join(", ")}
						</TooltipContent>
					</Tooltip>
				) : (
					<Button onClick={handleSave} disabled={!hasChanges || isLoading || isQueriesLoading || !hasSettingsUpdateAccess}>
						{isLoading ? t("common.actions.saving") : t("common.actions.saveChanges")}
					</Button>
				)}
			</div>
		</div>
	);
}