// OAuth grant 行级操作菜单：可跳转到按当前身份预筛选的 auth sessions，也可触发 revoke 确认弹窗。

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import type { OAuth2GrantRow } from "@/lib/store/apis/oauth2SessionsApi";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GrantActionsProps {
	row: OAuth2GrantRow;
	revoking: boolean;
	isPendingRow: boolean;
	onRevoke: () => void;
}

export default function GrantActions({ row, revoking, isPendingRow, onRevoke }: GrantActionsProps) {
	const { t } = useTranslation();
	const busy = revoking;
	// 跳转到按当前 grant 身份精确过滤后的 Auth Sessions 页面。
	const authSessionsUrl = `/workspace/mcp-sessions?auth_mode=${row.bf_mode}&identity=${encodeURIComponent(row.bf_sub)}`;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					data-testid="oauth-grants-actions-trigger"
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					aria-label={t("oauthGrants.actions.grantActions")}
					disabled={busy}
				>
					{busy && isPendingRow ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{(row.bf_mode === "user" || row.bf_mode === "vk" || row.bf_mode === "session") && (
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link to={authSessionsUrl} data-testid="oauth-grants-view-sessions-link">
							<ExternalLink className="h-4 w-4" />
							{t("oauthGrants.actions.viewAuthSessions")}
						</Link>
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					data-testid="oauth-grants-revoke-action"
					variant="destructive"
					className="cursor-pointer"
					disabled={busy}
					onSelect={(e) => {
						e.preventDefault();
						onRevoke();
					}}
				>
					<Trash2 className="h-4 w-4" />
					{t("oauthGrants.actions.revoke")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}