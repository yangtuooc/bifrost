import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alertDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetDurationLabels, supportsCalendarAlignment } from "@/lib/constants/governance";
import { ProviderIconType, RenderProviderIcon } from "@/lib/constants/icons";
import { ProviderLabels, ProviderName } from "@/lib/constants/logs";
import { getModelLimitScope, getModelLimitScopes } from "@/lib/registries/modelLimitScopes";
import { getErrorMessage, useDeleteModelConfigMutation } from "@/lib/store";
import { ModelProvider } from "@/lib/types/config";
import { ModelConfig } from "@/lib/types/governance";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/governance";
import { getScopeLabel } from "@/lib/utils/labels";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { ArrowUpRight, ChevronLeft, ChevronRight, Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ModelLimitSheet from "./modelLimitSheet";
import { ModelLimitsEmptyState } from "./modelLimitsEmptyState";
// 副作用导入：加载下游 scope 注册，OSS 构建中为空模块。
import "@enterprise/lib/registrations/modelLimitScopes";
import { PIN_SHADOW_RIGHT } from "@/components/table/columnPinning";
import { useNavigate } from "@tanstack/react-router";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const resetDurationLabelKeys: Record<string, string> = {
	"1m": "common.resetDurations.everyMinute",
	"5m": "common.resetDurations.everyFiveMinutes",
	"15m": "common.resetDurations.everyFifteenMinutes",
	"30m": "common.resetDurations.everyThirtyMinutes",
	"1h": "common.resetDurations.hourly",
	"6h": "common.resetDurations.everySixHours",
	"1d": "common.resetDurations.daily",
	"1w": "common.resetDurations.weekly",
	"1M": "common.resetDurations.monthly",
};

const scopeLabelKeys: Record<string, string> = {
	global: "modelLimits.scopes.global",
	virtual_key: "modelLimits.scopes.virtualKey",
	team: "modelLimits.scopes.team",
	customer: "modelLimits.scopes.customer",
	user: "modelLimits.scopes.user",
};

const formatResetDuration = (duration: string, t: Translate) => {
	const key = resetDurationLabelKeys[duration];
	return key ? t(key) : resetDurationLabels[duration] || duration;
};

const formatScopeLabel = (scope: string, fallbackLabel: string, t: Translate) => {
	const key = scopeLabelKeys[scope];
	return key ? t(key) : fallbackLabel;
};

const toTestIdPart = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

function ModelLimitActionsMenu({
	config,
	hasUpdateAccess,
	hasDeleteAccess,
	onEdit,
	onDelete,
}: {
	config: ModelConfig;
	hasUpdateAccess: boolean;
	hasDeleteAccess: boolean;
	onEdit: (config: ModelConfig) => void;
	onDelete: (configId: string) => void;
}) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					aria-label={t("modelLimits.actionsMenu.aria", { model: config.model_name })}
					data-testid={`model-limit-button-actions-${toTestIdPart(config.model_name)}-${toTestIdPart(config.provider || "all")}`}
				>
					<MoreHorizontal className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					className="cursor-pointer"
					disabled={!hasUpdateAccess}
					data-testid={`model-limit-button-edit-${toTestIdPart(config.model_name)}-${toTestIdPart(config.provider || "all")}`}
					onSelect={(e) => {
						e.preventDefault();
						onEdit(config);
						setIsOpen(false);
					}}
				>
					<Edit className="h-4 w-4" />
					{t("common.actions.edit")}
				</DropdownMenuItem>
				<DropdownMenuItem
					variant="destructive"
					className="cursor-pointer"
					disabled={!hasDeleteAccess}
					data-testid={`model-limit-button-delete-${toTestIdPart(config.model_name)}-${toTestIdPart(config.provider || "all")}`}
					onSelect={(e) => {
						e.preventDefault();
						onDelete(config.id);
						setIsOpen(false);
					}}
				>
					<Trash2 className="h-4 w-4" />
					{t("common.actions.delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface ModelLimitsTableProps {
	modelConfigs: ModelConfig[];
	totalCount: number;
	providers: ModelProvider[];
	search: string;
	debouncedSearch: string;
	onSearchChange: (value: string) => void;
	scope: string;
	onScopeChange: (value: string) => void;
	provider: string;
	onProviderChange: (value: string) => void;
	offset: number;
	limit: number;
	onOffsetChange: (offset: number) => void;
	isLoading?: boolean;
}

export default function ModelLimitsTable({
	modelConfigs,
	totalCount,
	providers,
	search,
	debouncedSearch,
	onSearchChange,
	scope,
	onScopeChange,
	provider,
	onProviderChange,
	offset,
	limit,
	onOffsetChange,
	isLoading = false,
}: ModelLimitsTableProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [showModelLimitSheet, setShowModelLimitSheet] = useState(false);
	const [editingModelConfigId, setEditingModelConfigId] = useState<string | null>(null);
	const [deleteModelConfigId, setDeleteModelConfigId] = useState<string | null>(null);

	// 从 props 派生当前编辑对象，确保它和 RTK cache 更新保持同步。
	const editingModelConfig = useMemo(
		() => (editingModelConfigId ? (modelConfigs.find((mc) => mc.id === editingModelConfigId) ?? null) : null),
		[editingModelConfigId, modelConfigs],
	);
	const deletingModelConfig = useMemo(
		() => (deleteModelConfigId ? (modelConfigs.find((mc) => mc.id === deleteModelConfigId) ?? null) : null),
		[deleteModelConfigId, modelConfigs],
	);

	const hasCreateAccess = useRbac(RbacResource.Governance, RbacOperation.Create);
	const hasUpdateAccess = useRbac(RbacResource.Governance, RbacOperation.Update);
	const hasDeleteAccess = useRbac(RbacResource.Governance, RbacOperation.Delete);

	const [deleteModelConfig, { isLoading: isDeleting }] = useDeleteModelConfigMutation();

	const handleDelete = async (id: string) => {
		try {
			await deleteModelConfig(id).unwrap();
			toast.success(t("modelLimits.toasts.deleted"));
			setDeleteModelConfigId(null);
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};

	const handleAddModelLimit = () => {
		setEditingModelConfigId(null);
		setShowModelLimitSheet(true);
	};

	const handleEditModelLimit = (config: ModelConfig) => {
		setEditingModelConfigId(config.id);
		setShowModelLimitSheet(true);
	};

	const handleModelLimitSaved = () => {
		setShowModelLimitSheet(false);
		setEditingModelConfigId(null);
	};

	const hasActiveFilters = debouncedSearch || scope || provider;

	// 真空态：完全没有模型限制，而不是筛选结果为空。
	// 初次加载期间不展示空态，避免 API 响应前闪烁。
	if (totalCount === 0 && !hasActiveFilters && !isLoading) {
		return (
			<>
				{showModelLimitSheet && (
					<ModelLimitSheet modelConfig={editingModelConfig} onSave={handleModelLimitSaved} onCancel={() => setShowModelLimitSheet(false)} />
				)}
				<ModelLimitsEmptyState onAddClick={handleAddModelLimit} canCreate={hasCreateAccess} />
			</>
		);
	}

	return (
		<>
			{showModelLimitSheet && (
				<ModelLimitSheet modelConfig={editingModelConfig} onSave={handleModelLimitSaved} onCancel={() => setShowModelLimitSheet(false)} />
			)}
			<AlertDialog open={!!deletingModelConfig} onOpenChange={(open) => !open && setDeleteModelConfigId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("modelLimits.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("modelLimits.deleteDialog.description", {
								model:
									deletingModelConfig?.model_name && deletingModelConfig.model_name.length > 30
										? `${deletingModelConfig.model_name.slice(0, 30)}...`
										: deletingModelConfig?.model_name,
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deletingModelConfig && handleDelete(deletingModelConfig.id)}
							disabled={isDeleting}
							className="bg-red-600 hover:bg-red-700"
						>
							{isDeleting ? t("common.actions.deleting") : t("common.actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<div className="flex flex-col overflow-y-auto">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold">{t("modelLimits.title")}</h1>
						<p className="text-muted-foreground text-sm">{t("modelLimits.description")}</p>
					</div>
					<Button onClick={handleAddModelLimit} disabled={!hasCreateAccess} data-testid="model-limits-button-create">
						<Plus className="h-4 w-4" />
						{t("modelLimits.add")}
					</Button>
				</div>

				{/* 工具栏：搜索和筛选 */}
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<div className="relative min-w-[220px] flex-1">
						<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
						<Input
							aria-label={t("modelLimits.filters.searchAria")}
							placeholder={t("modelLimits.filters.searchPlaceholder")}
							value={search}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-9"
							data-testid="model-limits-search-input"
						/>
					</div>

					<Select value={scope || "all"} onValueChange={(v) => onScopeChange(v === "all" ? "" : v)}>
						<SelectTrigger className="w-[160px]" data-testid="model-limits-filter-scope">
							<SelectValue placeholder={t("modelLimits.filters.allScopes")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("modelLimits.filters.allScopes")}</SelectItem>
							{getModelLimitScopes().map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{formatScopeLabel(o.value, o.label, t)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={provider || "all"} onValueChange={(v) => onProviderChange(v === "all" ? "" : v)}>
						<SelectTrigger className="w-[160px]" data-testid="model-limits-filter-provider">
							<SelectValue placeholder={t("common.filters.allProviders")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("common.filters.allProviders")}</SelectItem>
							{(providers ?? []).map((p) => (
								<SelectItem key={p.name} value={p.name}>
									<div className="flex items-center gap-2">
										<RenderProviderIcon provider={p.name as ProviderIconType} size="sm" className="h-4 w-4" />
										<span>{ProviderLabels[p.name as ProviderName] || p.name}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								onSearchChange("");
								onScopeChange("");
								onProviderChange("");
							}}
							data-testid="model-limits-filter-clear"
						>
							{t("modelLimits.filters.clear")}
						</Button>
					)}
				</div>

				<div className="mb-2 overflow-hidden rounded-sm border" data-testid="model-limits-table">
					<Table containerClassName="h-full overflow-auto">
						<TableHeader className="bg-muted sticky top-0 z-10">
							<TableRow className="hover:bg-transparent">
								<TableHead className="font-medium">{t("modelLimits.table.model")}</TableHead>
								<TableHead className="font-medium">{t("modelLimits.table.provider")}</TableHead>
								<TableHead className="font-medium">{t("modelLimits.table.scope")}</TableHead>
								<TableHead className="font-medium">{t("modelLimits.table.scopeTarget")}</TableHead>
								<TableHead className="font-medium">{t("modelLimits.table.budget")}</TableHead>
								<TableHead className="font-medium">{t("modelLimits.table.rateLimit")}</TableHead>
								<TableHead className={`bg-muted sticky right-0 z-30 w-[50px] text-right ${PIN_SHADOW_RIGHT}`}></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{modelConfigs.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="h-24 text-center">
										<span className="text-muted-foreground text-sm">
											{isLoading ? t("modelLimits.table.loading") : t("modelLimits.table.noMatching")}
										</span>
									</TableCell>
								</TableRow>
							) : (
								modelConfigs.map((config) => {
									// 模型配置可以拥有多个预算，和 VK 表格一样全部展示。
									const budgets = config.budgets ?? (config.budget ? [config.budget] : []);
									const isBudgetExhausted = budgets.some((b) => b.max_limit > 0 && b.current_usage >= b.max_limit);
									const isRateLimitExhausted =
										(config.rate_limit?.token_max_limit &&
											config.rate_limit.token_max_limit > 0 &&
											config.rate_limit.token_current_usage >= config.rate_limit.token_max_limit) ||
										(config.rate_limit?.request_max_limit &&
											config.rate_limit.request_max_limit > 0 &&
											config.rate_limit.request_current_usage >= config.rate_limit.request_max_limit);
									const isExhausted = isBudgetExhausted || isRateLimitExhausted;

									// 计算安全百分比，避免除以零。
									const tokenPercentage =
										config.rate_limit?.token_max_limit && config.rate_limit.token_max_limit > 0
											? Math.min((config.rate_limit.token_current_usage / config.rate_limit.token_max_limit) * 100, 100)
											: 0;
									const requestPercentage =
										config.rate_limit?.request_max_limit && config.rate_limit.request_max_limit > 0
											? Math.min((config.rate_limit.request_current_usage / config.rate_limit.request_max_limit) * 100, 100)
											: 0;

									return (
										<TableRow
											key={config.id}
											data-testid={`model-limit-row-${toTestIdPart(config.model_name)}-${toTestIdPart(config.provider || "all")}`}
											className={cn("group transition-colors", isExhausted && "bg-red-500/5 hover:bg-red-500/10")}
										>
											<TableCell className="max-w-[280px] py-4">
												<div className="flex flex-col gap-2">
													<span className="truncate font-mono text-sm font-medium">
														{config.model_name === "*" ? t("common.filters.allModels") : config.model_name}
													</span>
													{isExhausted && (
														<Badge variant="destructive" className="w-fit text-xs">
															{t("modelLimits.table.limitReached")}
														</Badge>
													)}
												</div>
											</TableCell>
											<TableCell>
												{config.provider ? (
													<div className="flex items-center gap-2">
														<RenderProviderIcon provider={config.provider as ProviderIconType} size="sm" className="h-4 w-4" />
														<span className="text-sm">{ProviderLabels[config.provider as ProviderName] || config.provider}</span>
													</div>
												) : (
													<span className="text-muted-foreground text-sm">{t("common.filters.allProviders")}</span>
												)}
											</TableCell>
											<TableCell>
												<Badge variant="secondary">
													{formatScopeLabel(config.scope ?? "global", getScopeLabel(config.scope ?? "global"), t)}
												</Badge>
											</TableCell>
											<TableCell>
												{config.scope !== "global" && config.scope_id && config.scope_name ? (
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Badge
																	variant="secondary"
																	className="flex max-w-[160px] cursor-pointer items-center gap-1 hover:opacity-80"
																	data-testid={`model-limit-scope-target-${config.scope_id}`}
																	onClick={() => {
																		if (!config.scope_id) return;
																		const target = getModelLimitScope(config.scope ?? "global")?.buildDeepLink?.(config.scope_id);
																		if (target) navigate(target as never);
																	}}
																>
																	<span className="truncate">{config.scope_name}</span>
																	<ArrowUpRight className="h-3 w-3 shrink-0" />
																</Badge>
															</TooltipTrigger>
															<TooltipContent className="max-w-[320px] break-all">{config.scope_name}</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												) : (
													<span className="text-muted-foreground text-sm">-</span>
												)}
											</TableCell>
											<TableCell className="min-w-[180px]">
												{budgets.length > 0 ? (
													<div className="flex flex-col gap-1">
														{budgets.map((b, idx) => (
															<div key={b.id ?? idx} className="flex flex-col">
																<span
																	className={cn("font-mono text-sm", b.max_limit > 0 && b.current_usage >= b.max_limit && "text-red-400")}
																>
																	{formatCurrency(b.current_usage)} / {formatCurrency(b.max_limit)}
																</span>
																<span className="text-muted-foreground text-xs">
																	{t("modelLimits.table.resets", { duration: formatResetDuration(b.reset_duration, t) })}
																	{config.calendar_aligned &&
																		supportsCalendarAlignment(b.reset_duration) &&
																		t("modelLimits.table.calendarSuffix")}
																</span>
															</div>
														))}
													</div>
												) : (
													<span className="text-muted-foreground text-sm">-</span>
												)}
											</TableCell>
											<TableCell className="min-w-[180px]">
												{config.rate_limit ? (
													<div className="space-y-2.5">
														{config.rate_limit.token_max_limit && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div className="space-y-1.5">
																			<div className="flex items-center justify-between gap-4 text-xs">
																				<span className="font-medium">
																					{config.rate_limit.token_max_limit.toLocaleString()} {t("modelLimits.units.tokens")}
																				</span>
																				<span className="text-muted-foreground">
																					{formatResetDuration(config.rate_limit.token_reset_duration || "1h", t)}
																				</span>
																			</div>
																			<Progress
																				value={tokenPercentage}
																				className={cn(
																					"bg-muted/70 dark:bg-muted/30 h-1",
																					config.rate_limit.token_current_usage >= config.rate_limit.token_max_limit
																						? "[&>div]:bg-red-500/70"
																						: tokenPercentage > 80
																							? "[&>div]:bg-amber-500/70"
																							: "[&>div]:bg-emerald-500/70",
																				)}
																			/>
																		</div>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p className="font-medium">
																			{config.rate_limit.token_current_usage.toLocaleString()} /{" "}
																			{config.rate_limit.token_max_limit.toLocaleString()} {t("modelLimits.units.tokens")}
																		</p>
																		<p className="text-primary-foreground/80 text-xs">
																			{t("modelLimits.table.resets", {
																				duration: formatResetDuration(config.rate_limit.token_reset_duration || "1h", t),
																			})}
																		</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
														{config.rate_limit.request_max_limit && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div className="space-y-1.5">
																			<div className="flex items-center justify-between gap-4 text-xs">
																				<span className="font-medium">
																					{config.rate_limit.request_max_limit.toLocaleString()} {t("modelLimits.units.requestsShort")}
																				</span>
																				<span className="text-muted-foreground">
																					{formatResetDuration(config.rate_limit.request_reset_duration || "1h", t)}
																				</span>
																			</div>
																			<Progress
																				value={requestPercentage}
																				className={cn(
																					"bg-muted/70 dark:bg-muted/30 h-1",
																					config.rate_limit.request_current_usage >= config.rate_limit.request_max_limit
																						? "[&>div]:bg-red-500/70"
																						: requestPercentage > 80
																							? "[&>div]:bg-amber-500/70"
																							: "[&>div]:bg-emerald-500/70",
																				)}
																			/>
																		</div>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p className="font-medium">
																			{config.rate_limit.request_current_usage.toLocaleString()} /{" "}
																			{config.rate_limit.request_max_limit.toLocaleString()} {t("modelLimits.units.requests")}
																		</p>
																		<p className="text-primary-foreground/80 text-xs">
																			{t("modelLimits.table.resets", {
																				duration: formatResetDuration(config.rate_limit.request_reset_duration || "1h", t),
																			})}
																		</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
												) : (
													<span className="text-muted-foreground text-sm">-</span>
												)}
											</TableCell>
											<TableCell
												className={cn(
													"group-hover:bg-muted dark:bg-card dark:group-hover:bg-muted sticky right-0 z-20 bg-white text-right",
													PIN_SHADOW_RIGHT,
												)}
												onClick={(e) => e.stopPropagation()}
											>
												<div className="flex items-center justify-center">
													<ModelLimitActionsMenu
														config={config}
														hasUpdateAccess={hasUpdateAccess}
														hasDeleteAccess={hasDeleteAccess}
														onEdit={handleEditModelLimit}
														onDelete={setDeleteModelConfigId}
													/>
												</div>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{/* 分页 */}
				{totalCount > 0 && (
					<div className="flex shrink-0 items-center justify-between text-xs" data-testid="pagination">
						<div className="text-muted-foreground flex items-center gap-2">
							{t("common.pagination.entriesRange", {
								start: (offset + 1).toLocaleString(),
								end: Math.min(offset + limit, totalCount).toLocaleString(),
								total: totalCount.toLocaleString(),
							})}
						</div>

						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOffsetChange(Math.max(0, offset - limit))}
								disabled={offset === 0}
								data-testid="model-limits-pagination-prev-btn"
								aria-label={t("common.pagination.previousPage")}
							>
								<ChevronLeft className="size-3" />
							</Button>

							<div className="flex items-center gap-1">
								<span>{t("common.pagination.page")}</span>
								<span>{Math.floor(offset / limit) + 1}</span>
								<span>{t("common.pagination.of", { total: Math.ceil(totalCount / limit) })}</span>
							</div>

							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOffsetChange(offset + limit)}
								disabled={offset + limit >= totalCount}
								data-testid="model-limits-pagination-next-btn"
								aria-label={t("common.pagination.nextPage")}
							>
								<ChevronRight className="size-3" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</>
	);
}