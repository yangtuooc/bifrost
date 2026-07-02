// OAuth grants 结果表：每行展示一个 active downstream grant，以及绑定身份、近似 access-token 过期时间、
// 创建/最后使用的相对时间和行级操作菜单。该组件负责空状态和分页。

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PIN_SHADOW_RIGHT } from "@/components/table/columnPinning";
import type { OAuth2GrantRow } from "@/lib/store/apis/oauth2SessionsApi";
import { ChevronLeft, ChevronRight, Fingerprint, Info, KeyRound, UserRound } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import GrantActions from "./grantActions";

interface GrantsTableProps {
	rows: OAuth2GrantRow[];
	totalCount: number;
	offset: number;
	pageSize: number;
	onOffsetChange: (offset: number) => void;
	isFetching: boolean;
	hasActiveFilters: boolean;
	revoking: boolean;
	pendingActionRowId: string | null;
	onRevoke: (row: OAuth2GrantRow) => void;
}

export default function GrantsTable({
	rows,
	totalCount,
	offset,
	pageSize,
	onOffsetChange,
	isFetching,
	hasActiveFilters,
	revoking,
	pendingActionRowId,
	onRevoke,
}: GrantsTableProps) {
	const { t } = useTranslation();

	return (
		<div className="flex grow flex-col overflow-hidden">
			<div className={`mb-2 grow overflow-hidden rounded-sm border ${isFetching ? "opacity-70 transition-opacity" : ""}`}>
				<Table containerClassName="h-full overflow-auto">
					<TableHeader className="bg-muted sticky top-0 z-20">
						<TableRow>
							<TableHead>{t("oauthGrants.table.client")}</TableHead>
							<TableHead>
								<HeaderWithTooltip label={t("oauthGrants.table.boundTo")} tooltip={t("oauthGrants.tooltips.boundTo")} />
							</TableHead>
							<TableHead>
								<HeaderWithTooltip label={t("oauthGrants.table.accessTokenExpiry")} tooltip={t("oauthGrants.tooltips.accessTokenExpiry")} />
							</TableHead>
							<TableHead>{t("oauthGrants.table.created")}</TableHead>
							<TableHead>
								<HeaderWithTooltip label={t("oauthGrants.table.lastUsed")} tooltip={t("oauthGrants.tooltips.lastUsed")} />
							</TableHead>
							<TableHead className={`bg-muted relative sticky right-0 z-10 w-[56px] text-right ${PIN_SHADOW_RIGHT}`} />
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									{hasActiveFilters ? (
										<div className="text-muted-foreground text-sm">{t("oauthGrants.empty.noFilterMatches")}</div>
									) : (
										<EmptyGrantsState />
									)}
								</TableCell>
							</TableRow>
						) : (
							rows.map((row) => (
								<TableRow key={row.id} className="group">
									<TableCell className="font-medium">{row.client_name || row.client_id}</TableCell>
									<TableCell>
										<BindingCell row={row} />
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										<AccessTokenExpiry row={row} />
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">{formatRelativePast(row.created_at, t)}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatRelativePast(row.last_used_at || row.created_at, t)}
									</TableCell>
									<TableCell
										className={`group-hover:bg-muted dark:bg-card dark:group-hover:bg-muted relative sticky right-0 z-10 bg-white text-right ${PIN_SHADOW_RIGHT}`}
									>
										<GrantActions
											row={row}
											revoking={revoking}
											isPendingRow={pendingActionRowId === row.id}
											onRevoke={() => onRevoke(row)}
										/>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{totalCount > 0 && (
				<div className="flex shrink-0 items-center justify-between text-xs" data-testid="pagination">
					<div className="text-muted-foreground flex items-center gap-2">
						{t("common.pagination.entriesRange", {
							start: (offset + 1).toLocaleString(),
							end: Math.min(offset + pageSize, totalCount).toLocaleString(),
							total: totalCount.toLocaleString(),
						})}
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
							disabled={offset === 0}
							data-testid="oauth-grants-prev-page-btn"
							aria-label={t("common.pagination.previousPage")}
						>
							<ChevronLeft className="size-3" />
						</Button>

						<div className="flex items-center gap-1">
							<span>{t("common.pagination.page")}</span>
							<span>{Math.floor(offset / pageSize) + 1}</span>
							<span>{t("common.pagination.of", { total: Math.ceil(totalCount / pageSize) })}</span>
						</div>

						<Button
							variant="ghost"
							size="sm"
							onClick={() => onOffsetChange(offset + pageSize)}
							disabled={offset + pageSize >= totalCount}
							data-testid="oauth-grants-next-page-btn"
							aria-label={t("common.pagination.nextPage")}
						>
							<ChevronRight className="size-3" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function BindingCell({ row }: { row: OAuth2GrantRow }) {
	const display = row.bf_sub_display || row.bf_sub;
	if (row.bf_mode === "user") {
		return (
			<span className="inline-flex items-center gap-2">
				<UserRound className="text-muted-foreground size-3.5 shrink-0" />
				<span className="text-sm">{display}</span>
			</span>
		);
	}
	if (row.bf_mode === "vk") {
		return (
			<span className="inline-flex items-center gap-2">
				<KeyRound className="text-muted-foreground size-3.5 shrink-0" />
				<span className="text-sm">{display}</span>
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-2">
			<Fingerprint className="text-muted-foreground size-3.5 shrink-0" />
			<span className="font-mono text-sm">{display}</span>
		</span>
	);
}

function AccessTokenExpiry({ row }: { row: OAuth2GrantRow }) {
	const { t } = useTranslation();

	// Access token TTL 默认 10 分钟（600s）。Access token 是无状态 JWT，不在服务端存储，
	// 因此这里用 grant 的最后活动时间近似估算过期时间。
	const baseMs = new Date(row.last_used_at ?? row.created_at).getTime();
	if (!Number.isFinite(baseMs)) {
		return <span className="text-muted-foreground">{t("oauthGrants.table.unknown")}</span>;
	}
	const expiryMs = baseMs + 600_000; // 10 min default
	const diffMs = expiryMs - Date.now();
	if (diffMs < 0) {
		return <span className="text-muted-foreground">{t("oauthGrants.table.refreshesOnNextUse")}</span>;
	}
	const mins = Math.ceil(diffMs / 60_000);
	return <span>{t("oauthGrants.table.expiresInMinutes", { minutes: mins })}</span>;
}

function HeaderWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex cursor-help items-center gap-2">
						{label}
						<Info className="text-muted-foreground size-3" />
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function EmptyGrantsState() {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col items-center gap-3 py-4">
			<p className="text-muted-foreground text-sm">{t("oauthGrants.empty.noGrants")}</p>
		</div>
	);
}

function formatRelativePast(iso: string, t: TFunction): string {
	try {
		const ts = new Date(iso).getTime();
		if (!Number.isFinite(ts)) return iso;
		const diffMs = Date.now() - ts;
		if (diffMs < 0) return t("oauthGrants.relative.justNow");
		const mins = Math.floor(diffMs / 60_000);
		if (mins < 1) return t("oauthGrants.relative.justNow");
		if (mins < 60) return t("oauthGrants.relative.minutesAgo", { minutes: mins });
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return t("oauthGrants.relative.hoursAgo", { hours: hrs });
		const days = Math.floor(hrs / 24);
		return t("oauthGrants.relative.daysAgo", { days });
	} catch {
		return iso;
	}
}