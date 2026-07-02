import { SheetNavigationButtons } from "@/components/sheetNavigationButtons";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DottedSeparator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSheetNavigation } from "@/hooks/useSheetNavigation";
import { supportsCalendarAlignment } from "@/lib/constants/governance";
import { ProviderIconType, RenderProviderIcon } from "@/lib/constants/icons";
import { ProviderLabels, ProviderName } from "@/lib/constants/logs";
import { VirtualKey } from "@/lib/types/governance";
import { cn } from "@/lib/utils";
import { calculateUsagePercentage, formatCurrency, parseResetPeriod } from "@/lib/utils/governance";
import ManagedVirtualKeyNotice from "@enterprise/components/access-profiles/managedVirtualKeyNotice";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVirtualKeyUsage } from "../hooks/useVirtualKeyUsage";

function usageBarClass(pct: number, exhausted: boolean) {
	if (exhausted) return "[&>div]:bg-red-500/70";
	if (pct > 80) return "[&>div]:bg-amber-500/70";
	return "[&>div]:bg-emerald-500/70";
}

function UsageLine({ current, max, format }: { current: number; max: number; format: (n: number) => string }) {
	const pct = calculateUsagePercentage(current, max);
	const exhausted = max > 0 && current >= max;
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<span className="font-mono text-sm">
					{format(current)} <span className="text-muted-foreground">/</span> {format(max)}
				</span>
				<span
					className={cn(
						"text-xs font-medium tabular-nums",
						exhausted ? "text-red-500" : pct > 80 ? "text-amber-500" : "text-muted-foreground",
					)}
				>
					{pct}%
				</span>
			</div>
			<Progress value={Math.min(pct, 100)} className={cn("bg-muted/70 dark:bg-muted/30 h-1.5", usageBarClass(pct, exhausted))} />
		</div>
	);
}

interface VirtualKeyDetailSheetProps {
	virtualKey: VirtualKey;
	onClose: () => void;
	onNavigate?: (direction: "prev" | "next") => void;
	hasPrev?: boolean;
	hasNext?: boolean;
}

export default function VirtualKeyDetailSheet({
	virtualKey,
	onClose,
	onNavigate,
	hasPrev = false,
	hasNext = false,
}: VirtualKeyDetailSheetProps) {
	const { t, i18n } = useTranslation();
	const { assignedUsers, isManagedByProfile, managingProfile, hasApRateLimit, displayBudgets, displayRateLimit } =
		useVirtualKeyUsage(virtualKey);
	const dateLocale = i18n.resolvedLanguage === "zh" ? zhCN : enUS;
	const formatRelativeTime = (date: Date) => formatDistanceToNow(date, { addSuffix: true, locale: dateLocale });

	const { prev: prevKeys, next: nextKeys } = useSheetNavigation({
		enabled: true,
		hasPrev,
		hasNext,
		onNavigate: (direction) => onNavigate?.(direction),
	});

	const getEntityInfo = () => {
		if (virtualKey.team) {
			return { type: t("virtualKeys.details.entities.team"), name: virtualKey.team.name };
		}
		if (virtualKey.customer) {
			return { type: t("virtualKeys.details.entities.customer"), name: virtualKey.customer.name };
		}
		return { type: t("virtualKeys.details.entities.none"), name: "" };
	};

	const entityInfo = getEntityInfo();

	const isExhausted =
		// Budget exhausted (AP-mirrored when managed, VK-own otherwise)
		displayBudgets?.some((b) => b.current_usage >= b.max_limit) ||
		// Rate limits exhausted
		(displayRateLimit?.token_current_usage &&
			displayRateLimit?.token_max_limit &&
			displayRateLimit.token_current_usage >= displayRateLimit.token_max_limit) ||
		(displayRateLimit?.request_current_usage &&
			displayRateLimit?.request_max_limit &&
			displayRateLimit.request_current_usage >= displayRateLimit.request_max_limit);

	return (
		<Sheet open onOpenChange={onClose}>
			<SheetContent className="flex w-full flex-col overflow-x-hidden p-0 pt-4 sm:max-w-2xl">
				<SheetHeader
					className="flex flex-row items-center justify-between px-0 py-4"
					headerClassName="mb-0 sticky -top-4 bg-card z-10 px-8"
				>
					<div className="flex flex-col items-start">
						<SheetTitle>{virtualKey.name}</SheetTitle>
						<SheetDescription>{virtualKey.description || t("virtualKeys.details.description")}</SheetDescription>
					</div>
					<SheetNavigationButtons
						hasPrev={hasPrev}
						hasNext={hasNext}
						onNavigate={(dir) => onNavigate?.(dir)}
						prevKeys={prevKeys}
						nextKeys={nextKeys}
						entityLabel={t("common.entities.virtualKey")}
					/>
				</SheetHeader>

				<div className="space-y-6 px-8 py-4">
					<ManagedVirtualKeyNotice managingProfile={managingProfile} />

					{assignedUsers.length > 0 ? (
						<div className="space-y-1">
							<Label className="text-sm font-medium">{t("virtualKeys.details.assignedUsers")}</Label>
							<div className="flex items-center gap-2">
								<Users className="text-muted-foreground h-4 w-4" />
								<span className="text-sm">{assignedUsers.map((u) => u.name || u.email).join(", ")}</span>
							</div>
						</div>
					) : null}

					{/* 基础信息 */}
					<div className="space-y-4">
						<h3 className="font-semibold">{t("virtualKeys.details.sections.basicInformation")}</h3>

						<div className="grid gap-4">
							<div className="grid grid-cols-3 items-center gap-4">
								<span className="text-muted-foreground text-sm">{t("virtualKeys.details.fields.status")}</span>
								<div className="col-span-2">
									<Badge variant={virtualKey.is_active ? (isExhausted ? "destructive" : "default") : "secondary"}>
										{virtualKey.is_active
											? isExhausted
												? t("virtualKeys.details.status.exhausted")
												: t("virtualKeys.details.status.active")
											: t("virtualKeys.details.status.inactive")}
									</Badge>
								</div>
							</div>

							<div className="grid grid-cols-3 items-center gap-4">
								<span className="text-muted-foreground text-sm">{t("virtualKeys.details.fields.created")}</span>
								<div className="col-span-2 text-sm">{formatRelativeTime(new Date(virtualKey.created_at))}</div>
							</div>

							<div className="grid grid-cols-3 items-center gap-4">
								<span className="text-muted-foreground text-sm">{t("virtualKeys.details.fields.lastUpdated")}</span>
								<div className="col-span-2 text-sm">{formatRelativeTime(new Date(virtualKey.updated_at))}</div>
							</div>

							{entityInfo.type !== t("virtualKeys.details.entities.none") && (
								<div className="grid grid-cols-3 items-center gap-4">
									<span className="text-muted-foreground text-sm">{t("virtualKeys.details.fields.assignedTo")}</span>
									<div className="col-span-2 flex items-center gap-2">
										<Badge variant={entityInfo.type === t("virtualKeys.details.entities.none") ? "outline" : "secondary"}>
											{entityInfo.type}
										</Badge>
										<span className="text-sm">{entityInfo.name}</span>
									</div>
								</div>
							)}
						</div>
					</div>

					<DottedSeparator />

					{/* Provider 配置 */}
					<div className="space-y-4">
						<h3 className="font-semibold">{t("virtualKeys.details.sections.providerConfigurations")}</h3>

						<div className="space-y-3">
							{!virtualKey.provider_configs || virtualKey.provider_configs.length === 0 ? (
								<span className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noProviders")}</span>
							) : (
								<div className="space-y-4">
									{virtualKey.provider_configs.map((config, index) => (
										<div key={`${config.provider}-${index}`} className="rounded-lg border p-4">
											{/* Provider 头部 */}
											<div className="mb-4 flex items-center justify-between">
												<div className="flex items-center gap-2">
													<RenderProviderIcon provider={config.provider as ProviderIconType} size="sm" className="h-5 w-5" />
													<span className="font-medium">{ProviderLabels[config.provider as ProviderName] || config.provider}</span>
												</div>
												<Badge variant="outline" className="font-mono text-xs">
													{t("virtualKeys.details.labels.weight", { weight: config.weight })}
												</Badge>
											</div>

											{/* 基础配置 */}
											<div className="space-y-3">
												<div className="grid grid-cols-3 items-start gap-4">
													<span className="text-muted-foreground pt-0.5 text-sm font-medium">
														{t("virtualKeys.details.fields.allowedModels")}
													</span>
													<div className="col-span-2">
														{config.allowed_models?.includes("*") ? (
															<Badge variant="success" className="text-xs">
																{t("virtualKeys.details.badges.allModels")}
															</Badge>
														) : config.allowed_models && config.allowed_models.length > 0 ? (
															<div className="flex flex-wrap gap-1">
																{config.allowed_models.map((model) => (
																	<Badge key={model} variant="secondary" className="text-xs">
																		{model}
																	</Badge>
																))}
															</div>
														) : (
															<Badge variant="destructive" className="text-xs">
																{t("virtualKeys.details.badges.noModels")}
															</Badge>
														)}
													</div>
												</div>

												<div className="grid grid-cols-3 items-start gap-4">
													<span className="text-muted-foreground pt-0.5 text-sm font-medium">
														{t("virtualKeys.details.fields.blockedModels")}
													</span>
													<div className="col-span-2">
														{config.blacklisted_models?.includes("*") ? (
															<Badge variant="destructive" className="text-xs">
																{t("virtualKeys.details.badges.allModelsBlocked")}
															</Badge>
														) : config.blacklisted_models && config.blacklisted_models.length > 0 ? (
															<div className="flex flex-wrap gap-1">
																{config.blacklisted_models.map((model) => (
																	<Badge key={model} variant="destructive" className="text-xs">
																		{model}
																	</Badge>
																))}
															</div>
														) : (
															<Badge variant="secondary" className="text-xs">
																{t("virtualKeys.details.badges.noModelsBlocked")}
															</Badge>
														)}
													</div>
												</div>

												<div className="grid grid-cols-3 items-start gap-4">
													<span className="text-muted-foreground pt-0.5 text-sm font-medium">
														{t("virtualKeys.details.fields.allowedKeys")}
													</span>
													<div className="col-span-2">
														{config.allow_all_keys ? (
															<Badge variant="success" className="text-xs">
																{t("virtualKeys.details.badges.allKeys")}
															</Badge>
														) : config.keys && config.keys.length > 0 ? (
															<div className="flex flex-wrap gap-1">
																{config.keys.map((key) => (
																	<Badge key={key.key_id} variant="outline" className="text-xs">
																		{key.name}
																	</Badge>
																))}
															</div>
														) : (
															<Badge variant="destructive" className="text-xs">
																{t("virtualKeys.details.badges.noKeys")}
															</Badge>
														)}
													</div>
												</div>

												{/* Provider 预算 */}
												{config.budgets && config.budgets.length > 0 && (
													<>
														<DottedSeparator />
														<div className="space-y-2">
															<h4 className="text-sm font-medium">{t("virtualKeys.details.sections.providerBudgets")}</h4>
															{config.budgets.map((b, bIdx) => (
																<div key={bIdx} className="space-y-2">
																	<UsageLine current={b.current_usage} max={b.max_limit} format={formatCurrency} />
																	<div className="text-muted-foreground flex items-center justify-between text-xs">
																		<span>
																			{t("virtualKeys.details.reset.resets", { period: parseResetPeriod(b.reset_duration) })}
																			{virtualKey.calendar_aligned &&
																				supportsCalendarAlignment(b.reset_duration) &&
																				t("virtualKeys.details.reset.calendarSuffix")}
																		</span>
																		{b.last_reset ? (
																			<span>
																				{t("virtualKeys.details.reset.lastReset", { time: formatRelativeTime(new Date(b.last_reset)) })}
																			</span>
																		) : null}
																	</div>
																</div>
															))}
														</div>
													</>
												)}

												{/* Provider 速率限制 */}
												{config.rate_limit && (
													<>
														<DottedSeparator />
														<div className="space-y-3">
															<h4 className="text-sm font-medium">{t("virtualKeys.details.sections.providerRateLimits")}</h4>

															{/* Token 限制 */}
															{config.rate_limit.token_max_limit != null ? (
																<div className="space-y-2">
																	<span className="text-muted-foreground text-xs font-medium">
																		{t("virtualKeys.details.sections.tokenLimitsShort")}
																	</span>
																	<UsageLine
																		current={config.rate_limit.token_current_usage}
																		max={config.rate_limit.token_max_limit}
																		format={(n) => n.toLocaleString()}
																	/>
																	<div className="text-muted-foreground flex items-center justify-between text-xs">
																		<span>
																			{t("virtualKeys.details.reset.resets", {
																				period: parseResetPeriod(config.rate_limit.token_reset_duration || ""),
																			})}
																			{virtualKey.calendar_aligned &&
																				supportsCalendarAlignment(config.rate_limit.token_reset_duration || "") &&
																				t("virtualKeys.details.reset.calendarSuffix")}
																		</span>
																		{config.rate_limit.token_last_reset ? (
																			<span>
																				{t("virtualKeys.details.reset.lastReset", {
																					time: formatRelativeTime(new Date(config.rate_limit.token_last_reset)),
																				})}
																			</span>
																		) : null}
																	</div>
																</div>
															) : null}

															{/* 请求限制 */}
															{config.rate_limit.request_max_limit != null ? (
																<div className="space-y-2">
																	<span className="text-muted-foreground text-xs font-medium">
																		{t("virtualKeys.details.sections.requestLimitsShort")}
																	</span>
																	<UsageLine
																		current={config.rate_limit.request_current_usage}
																		max={config.rate_limit.request_max_limit}
																		format={(n) => n.toLocaleString()}
																	/>
																	<div className="text-muted-foreground flex items-center justify-between text-xs">
																		<span>
																			{t("virtualKeys.details.reset.resets", {
																				period: parseResetPeriod(config.rate_limit.request_reset_duration || ""),
																			})}
																			{virtualKey.calendar_aligned &&
																				supportsCalendarAlignment(config.rate_limit.request_reset_duration || "") &&
																				t("virtualKeys.details.reset.calendarSuffix")}
																		</span>
																		{config.rate_limit.request_last_reset ? (
																			<span>
																				{t("virtualKeys.details.reset.lastReset", {
																					time: formatRelativeTime(new Date(config.rate_limit.request_last_reset)),
																				})}
																			</span>
																		) : null}
																	</div>
																</div>
															) : null}

															{config.rate_limit.token_max_limit == null && config.rate_limit.request_max_limit == null && (
																<p className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noProviderRateLimits")}</p>
															)}
														</div>
													</>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{/* MCP Client 配置 */}
					<div className="space-y-4">
						<h3 className="font-semibold">{t("virtualKeys.details.sections.mcpClientConfigurations")}</h3>

						<div className="space-y-3">
							{!virtualKey.mcp_configs || virtualKey.mcp_configs.length === 0 ? (
								<span className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noMcpClients")}</span>
							) : (
								<div className="rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>{t("virtualKeys.details.fields.mcpClient")}</TableHead>
												<TableHead>{t("virtualKeys.details.fields.allowedTools")}</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{virtualKey.mcp_configs.map((config, index) => (
												<TableRow key={`${config.mcp_client?.name || config.id}-${index}`}>
													<TableCell>{config.mcp_client?.name || t("virtualKeys.details.fallbacks.unknownClient")}</TableCell>
													<TableCell>
														{config.tools_to_execute?.includes("*") ? (
															<Badge variant="success" className="text-xs">
																{t("virtualKeys.details.badges.allTools")}
															</Badge>
														) : config.tools_to_execute && config.tools_to_execute.length > 0 ? (
															<div className="flex flex-wrap gap-1">
																{config.tools_to_execute.map((tool) => (
																	<Badge key={tool} variant="secondary" className="text-xs">
																		{tool}
																	</Badge>
																))}
															</div>
														) : (
															<Badge variant="destructive" className="text-xs">
																{t("virtualKeys.details.badges.noTools")}
															</Badge>
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</div>
					</div>

					<DottedSeparator />

					{/* 预算信息 */}
					<div className="space-y-4">
						<h3 className="font-semibold">
							{t("virtualKeys.details.sections.budgetInformation")}
							{isManagedByProfile && managingProfile?.budgets?.length ? (
								<span className="text-muted-foreground ml-2 text-xs font-normal">
									{t("virtualKeys.details.labels.fromProfile", { name: managingProfile.name })}
								</span>
							) : null}
						</h3>

						{displayBudgets && displayBudgets.length > 0 ? (
							<div className="space-y-4">
								{displayBudgets.map((b, bIdx) => (
									<div key={bIdx} className="space-y-2 rounded-lg border p-4">
										<UsageLine current={b.current_usage} max={b.max_limit} format={formatCurrency} />
										<div className="text-muted-foreground flex items-center justify-between text-xs">
											<span>
												{t("virtualKeys.details.reset.resets", { period: parseResetPeriod(b.reset_duration) })}
												{virtualKey.calendar_aligned &&
													supportsCalendarAlignment(b.reset_duration) &&
													t("virtualKeys.details.reset.calendarSuffix")}
											</span>
											{b.last_reset ? (
												<span>{t("virtualKeys.details.reset.lastReset", { time: formatRelativeTime(new Date(b.last_reset)) })}</span>
											) : null}
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noBudgetLimits")}</p>
						)}
					</div>

					{/* 速率限制 */}
					<div className="space-y-4">
						<h3 className="font-semibold">
							{t("virtualKeys.details.sections.rateLimits")}
							{isManagedByProfile && hasApRateLimit ? (
								<span className="text-muted-foreground ml-2 text-xs font-normal">
									{t("virtualKeys.details.labels.fromProfile", { name: managingProfile?.name })}
								</span>
							) : null}
						</h3>

						{displayRateLimit ? (
							<div className="space-y-4">
								{/* Token 限制 */}
								{displayRateLimit.token_max_limit != null ? (
									<div className="space-y-3 rounded-lg border p-4">
										<span className="text-sm font-medium">{t("virtualKeys.details.sections.tokenLimits")}</span>
										<UsageLine
											current={displayRateLimit.token_current_usage}
											max={displayRateLimit.token_max_limit}
											format={(n) => n.toLocaleString()}
										/>
										<div className="text-muted-foreground flex items-center justify-between text-xs">
											<span>
												{t("virtualKeys.details.reset.resets", { period: parseResetPeriod(displayRateLimit.token_reset_duration || "") })}
												{virtualKey.calendar_aligned &&
													supportsCalendarAlignment(displayRateLimit.token_reset_duration || "") &&
													t("virtualKeys.details.reset.calendarSuffix")}
											</span>
											{displayRateLimit.token_last_reset ? (
												<span>
													{t("virtualKeys.details.reset.lastReset", {
														time: formatRelativeTime(new Date(displayRateLimit.token_last_reset)),
													})}
												</span>
											) : null}
										</div>
									</div>
								) : null}

								{/* 请求限制 */}
								{displayRateLimit.request_max_limit != null ? (
									<div className="space-y-3 rounded-lg border p-4">
										<span className="text-sm font-medium">{t("virtualKeys.details.sections.requestLimits")}</span>
										<UsageLine
											current={displayRateLimit.request_current_usage}
											max={displayRateLimit.request_max_limit}
											format={(n) => n.toLocaleString()}
										/>
										<div className="text-muted-foreground flex items-center justify-between text-xs">
											<span>
												{t("virtualKeys.details.reset.resets", { period: parseResetPeriod(displayRateLimit.request_reset_duration || "") })}
												{virtualKey.calendar_aligned &&
													supportsCalendarAlignment(displayRateLimit.request_reset_duration || "") &&
													t("virtualKeys.details.reset.calendarSuffix")}
											</span>
											{displayRateLimit.request_last_reset ? (
												<span>
													{t("virtualKeys.details.reset.lastReset", {
														time: formatRelativeTime(new Date(displayRateLimit.request_last_reset)),
													})}
												</span>
											) : null}
										</div>
									</div>
								) : null}

								{displayRateLimit.token_max_limit == null && displayRateLimit.request_max_limit == null && (
									<p className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noRateLimits")}</p>
								)}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">{t("virtualKeys.details.empty.noRateLimits")}</p>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}