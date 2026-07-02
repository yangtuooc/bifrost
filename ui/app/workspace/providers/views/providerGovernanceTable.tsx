import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetProviderGovernanceQuery } from "@/lib/store";
import { ModelProvider } from "@/lib/types/config";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/governance";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useTranslation } from "react-i18next";

interface Props {
	className?: string;
	provider: ModelProvider;
}

const RESET_DURATION_TRANSLATION_KEYS: Record<string, string> = {
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

// 将 reset duration value 转成当前语言下的展示文案。
const formatResetDuration = (duration: string, t: (key: string) => string) => {
	const translationKey = RESET_DURATION_TRANSLATION_KEYS[duration];
	return translationKey ? t(translationKey) : duration;
};

// 环形进度组件。
function CircularProgress({
	value,
	max,
	size = 80,
	strokeWidth = 6,
	isExhausted = false,
}: {
	value: number;
	max: number;
	size?: number;
	strokeWidth?: number;
	isExhausted?: boolean;
}) {
	const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const strokeDashoffset = circumference - (percentage / 100) * circumference;

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="-rotate-90 transform">
				{/* 背景圆环 */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted/70 dark:text-muted/30"
				/>
				{/* 进度圆环 */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					strokeLinecap="round"
					className={cn(
						"transition-all duration-500",
						isExhausted ? "text-red-500/70" : percentage > 80 ? "text-amber-500/70" : "text-emerald-500/70",
					)}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span
					className={cn("text-lg font-medium", isExhausted ? "text-red-500/70" : percentage > 80 ? "text-amber-500/70" : "text-foreground")}
				>
					{Math.round(percentage)}%
				</span>
			</div>
		</div>
	);
}

// Governance 指标卡片。
function MetricCard({
	title,
	value,
	max,
	unit,
	resetDuration,
	isExhausted,
}: {
	title: string;
	value: number;
	max: number;
	unit: string;
	resetDuration: string;
	isExhausted: boolean;
}) {
	const { t } = useTranslation();
	// 避免除零，计算安全百分比。
	const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
	const clampedPercentage = Math.max(0, Math.min(100, percentage));
	const translatedUnit = unit === "$" ? unit : t(`providers.config.governance.units.${unit}`);

	return (
		<div
			className={cn(
				"group relative overflow-hidden rounded-sm border p-5 transition-all duration-300",
				"hover:shadow-lg hover:shadow-black/5",
				isExhausted ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card hover:border-border",
			)}
		>
			{/* 悬停时展示轻微渐变层。 */}
			<div className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

			<div className="relative flex items-start justify-between gap-4">
				<div className="flex-1 space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-muted-foreground text-sm font-medium whitespace-nowrap">{title}</span>
						{isExhausted && (
							<Badge variant="destructive" className="text-xs whitespace-nowrap">
								{t("providers.config.governance.exhausted")}
							</Badge>
						)}
					</div>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="space-y-1">
									<div className="flex items-baseline gap-1">
										<span className="text-2xl font-medium tracking-tight">
											{unit === "$" ? formatCurrency(value) : value.toLocaleString()}
										</span>
										<span className="text-muted-foreground text-sm">
											/ {unit === "$" ? formatCurrency(max) : `${max.toLocaleString()} ${translatedUnit}`}
										</span>
									</div>
									<div className="text-xs">
										<span className="text-muted-foreground">
											{t("providers.config.governance.resets", { duration: formatResetDuration(resetDuration, t) })}
										</span>
									</div>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p className="font-medium">{t("providers.config.governance.metricUsed", { percentage: clampedPercentage, title })}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				<CircularProgress value={value} max={max} isExhausted={isExhausted} />
			</div>
		</div>
	);
}

export default function ProviderGovernanceTable({ provider, className }: Props) {
	const { t } = useTranslation();
	const hasViewAccess = useRbac(RbacResource.Governance, RbacOperation.View);
	const { data: providerGovernanceData, isLoading } = useGetProviderGovernanceQuery(undefined, {
		skip: !hasViewAccess,
		pollingInterval: 5000,
	});

	// 查找当前 Provider 对应的 governance 数据。
	const providerGovernance = providerGovernanceData?.providers?.find((p) => p.provider === provider.name);

	// 没有任何 governance 配置时不展示该区域。
	const hasGovernance = (providerGovernance?.budgets?.length ?? 0) > 0 || providerGovernance?.rate_limit;

	if (isLoading) {
		return (
			<div className={cn("w-full", className)}>
				<CardHeader className="mb-4 px-0">
					<CardTitle className="flex items-center justify-between">
						<div className="flex items-center gap-2">{t("providers.config.tabs.governance")}</div>
					</CardTitle>
				</CardHeader>
				<div className="flex items-center justify-center py-12">
					<div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
				</div>
			</div>
		);
	}

	if (!hasGovernance) {
		return null;
	}

	const budgets = providerGovernance?.budgets ?? [];
	const rateLimit = providerGovernance?.rate_limit;

	const isTokenExhausted = !!(
		rateLimit?.token_max_limit &&
		rateLimit.token_max_limit > 0 &&
		rateLimit.token_current_usage >= rateLimit.token_max_limit
	);
	const isRequestExhausted = !!(
		rateLimit?.request_max_limit &&
		rateLimit.request_max_limit > 0 &&
		rateLimit.request_current_usage >= rateLimit.request_max_limit
	);

	return (
		<div className={cn("w-full", className)}>
			<CardHeader className="mb-4 px-0">
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">{t("providers.config.tabs.governance")}</div>
				</CardTitle>
			</CardHeader>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{/* 预算卡片：每个预算窗口一个。 */}
				{budgets.map((budget) => (
					<MetricCard
						key={budget.id}
						title={t("providers.config.governance.budgetWithDuration", {
							duration: formatResetDuration(budget.reset_duration, t),
						})}
						value={budget.current_usage}
						max={budget.max_limit}
						unit="$"
						resetDuration={budget.reset_duration}
						isExhausted={budget.max_limit > 0 && budget.current_usage >= budget.max_limit}
					/>
				))}

				{/* Token rate limit 卡片。 */}
				{rateLimit?.token_max_limit && (
					<MetricCard
						title={t("providers.config.governance.tokenLimit")}
						value={rateLimit.token_current_usage}
						max={rateLimit.token_max_limit}
						unit="tokens"
						resetDuration={rateLimit.token_reset_duration || "1h"}
						isExhausted={isTokenExhausted}
					/>
				)}

				{/* Request rate limit 卡片。 */}
				{rateLimit?.request_max_limit && (
					<MetricCard
						title={t("providers.config.governance.requestLimit")}
						value={rateLimit.request_current_usage}
						max={rateLimit.request_max_limit}
						unit="requests"
						resetDuration={rateLimit.request_reset_duration || "1h"}
						isExhausted={isRequestExhausted}
					/>
				)}
			</div>
		</div>
	);
}