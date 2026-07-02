// OAuth grant 撤销确认弹窗；open/confirm 状态由页面层控制。

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
import { useTranslation } from "react-i18next";

interface RevokeGrantDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export default function RevokeGrantDialog({ open, onOpenChange, onConfirm }: RevokeGrantDialogProps) {
	const { t } = useTranslation();

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("oauthGrants.revokeDialog.title")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("oauthGrants.revokeDialog.descriptionStart")} <code className="bg-muted rounded px-1 py-0.5 text-xs">/mcp</code>{" "}
						{t("oauthGrants.revokeDialog.descriptionEnd")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel data-testid="oauth-grants-revoke-cancel-btn">{t("common.actions.cancel")}</AlertDialogCancel>
					<AlertDialogAction data-testid="oauth-grants-revoke-confirm-btn" onClick={onConfirm}>
						{t("oauthGrants.actions.revoke")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}