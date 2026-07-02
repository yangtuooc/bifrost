// Grants 表格筛选条：支持按 client/identity 搜索，并按身份模式多选过滤。

import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Fingerprint, KeyRound, Search, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GrantsFilterBarProps {
	search: string;
	onSearchChange: (value: string) => void;
	modeFilter: string[];
	onModeChange: (value: string[]) => void;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
}

export default function GrantsFilterBar({
	search,
	onSearchChange,
	modeFilter,
	onModeChange,
	hasActiveFilters,
	onClearFilters,
}: GrantsFilterBarProps) {
	const { t } = useTranslation();
	const modeOptions = [
		{ label: t("oauthGrants.filters.modes.user"), value: "user", icon: <UserRound className="size-3.5" /> },
		{ label: t("oauthGrants.filters.modes.virtualKey"), value: "vk", icon: <KeyRound className="size-3.5" /> },
		{ label: t("oauthGrants.filters.modes.session"), value: "session", icon: <Fingerprint className="size-3.5" /> },
	];

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-3">
			<div className="relative max-w-sm min-w-[200px] flex-1">
				<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input
					data-testid="oauth-grants-search-input"
					aria-label={t("oauthGrants.filters.searchAria")}
					placeholder={t("oauthGrants.filters.searchPlaceholder")}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="pl-9"
				/>
			</div>
			<ComboboxSelect
				data-testid="oauth-grants-mode-filter"
				multiple
				disableSearch
				compactTrigger
				options={modeOptions}
				value={modeFilter}
				onValueChange={onModeChange}
				placeholder={t("oauthGrants.filters.allIdentities")}
				className="h-9 w-[180px]"
			/>
			{hasActiveFilters && (
				<Button data-testid="oauth-grants-clear-filters-btn" variant="ghost" size="sm" onClick={onClearFilters} className="h-9">
					<X className="h-4 w-4" />
					{t("oauthGrants.filters.clearFilters")}
				</Button>
			)}
		</div>
	);
}