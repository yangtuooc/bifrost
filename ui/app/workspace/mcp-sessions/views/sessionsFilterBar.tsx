// Inline filter row above the sessions table: search input + three multi-
// selects (kind, status, auth_mode) + a clear-filters affordance shown
// only when something is active.
//
// MCP-client filter is intentionally absent here. Adding it would need a
// separate source for the dropdown options (the existing list response
// only shows clients that have *sessions*, which is filter-dependent and
// would cause the option list to collapse as filters narrow). When we
// want it we'll piggyback on useGetMCPClientsQuery.

import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Fingerprint, KeyRound, Search, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface SessionsFilterBarProps {
	search: string;
	onSearchChange: (value: string) => void;
	kindFilter: string[];
	onKindFilterChange: (value: string[]) => void;
	statusFilter: string[];
	onStatusFilterChange: (value: string[]) => void;
	authModeFilter: string[];
	onAuthModeFilterChange: (value: string[]) => void;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
}

export default function SessionsFilterBar(props: SessionsFilterBarProps) {
	const { t } = useTranslation();
	const kindOptions = [
		{ label: t("mcpSessions.types.oauth"), value: "token" },
		{ label: t("mcpSessions.types.headers"), value: "header" },
	];
	const statusOptions = [
		{ label: t("mcpSessions.status.active"), value: "active" },
		{ label: t("mcpSessions.status.orphaned"), value: "orphaned" },
		{ label: t("mcpSessions.status.needsReauth"), value: "needs_reauth" },
		{ label: t("mcpSessions.status.needsUpdate"), value: "needs_update" },
		{ label: t("mcpSessions.status.pending"), value: "pending" },
	];
	const authModeOptions = [
		{ label: t("mcpSessions.filters.authModes.user"), value: "user", icon: <UserRound className="size-3.5" /> },
		{ label: t("mcpSessions.filters.authModes.virtualKey"), value: "vk", icon: <KeyRound className="size-3.5" /> },
		{ label: t("mcpSessions.filters.authModes.session"), value: "session", icon: <Fingerprint className="size-3.5" /> },
	];

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-3">
			<div className="relative max-w-sm min-w-[200px] flex-1">
				<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input
					aria-label={t("mcpSessions.filters.searchAria")}
					placeholder={t("mcpSessions.filters.searchPlaceholder")}
					value={props.search}
					onChange={(e) => props.onSearchChange(e.target.value)}
					className="pl-9"
					data-testid="mcp-sessions-search-input"
				/>
			</div>
			<ComboboxSelect
				multiple
				disableSearch
				compactTrigger
				data-testid="mcp-sessions-kind-filter"
				options={kindOptions}
				value={props.kindFilter}
				onValueChange={props.onKindFilterChange}
				placeholder={t("mcpSessions.filters.allTypes")}
				className="h-9 w-[180px]"
			/>
			<ComboboxSelect
				multiple
				disableSearch
				compactTrigger
				data-testid="mcp-sessions-status-filter"
				options={statusOptions}
				value={props.statusFilter}
				onValueChange={props.onStatusFilterChange}
				placeholder={t("mcpSessions.filters.allStatuses")}
				className="h-9 w-[180px]"
			/>
			<ComboboxSelect
				multiple
				disableSearch
				compactTrigger
				data-testid="mcp-sessions-auth-mode-filter"
				options={authModeOptions}
				value={props.authModeFilter}
				onValueChange={props.onAuthModeFilterChange}
				placeholder={t("mcpSessions.filters.allIdentities")}
				className="h-9 w-[180px]"
			/>
			{props.hasActiveFilters && (
				<Button variant="ghost" size="sm" onClick={props.onClearFilters} data-testid="mcp-sessions-clear-filters-btn" className="h-9">
					<X className="h-4 w-4" />
					{t("mcpSessions.filters.clearFilters")}
				</Button>
			)}
		</div>
	);
}