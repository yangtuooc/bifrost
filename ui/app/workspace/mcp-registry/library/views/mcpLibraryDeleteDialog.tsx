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
import type { MCPLibraryEntry } from "@/lib/types/mcp";
import { useTranslation } from "react-i18next";

interface MCPLibraryDeleteDialogProps {
	/** 正在移除的条目；为 null 时弹窗关闭。 */
	server: MCPLibraryEntry | null;
	open: boolean;
	isDeleting: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	confirmTestId: string;
}

// Library 条目的软删除确认弹窗，同时用于 card 和 table 视图。
export function MCPLibraryDeleteDialog({ server, open, isDeleting, onOpenChange, onConfirm, confirmTestId }: MCPLibraryDeleteDialogProps) {
	const { t } = useTranslation();
	const isCustom = server?.source === "custom";

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("mcpRegistry.library.deleteDialog.title", { name: server?.name })}</AlertDialogTitle>
					<AlertDialogDescription>
						{isCustom ? t("mcpRegistry.library.deleteDialog.customDescription") : t("mcpRegistry.library.deleteDialog.remoteDescription")}{" "}
						{t("mcpRegistry.library.deleteDialog.existingInstallations")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>{t("common.actions.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
						disabled={isDeleting}
						data-testid={confirmTestId}
					>
						{isDeleting ? t("mcpRegistry.library.deleteDialog.removing") : t("mcpRegistry.library.deleteDialog.remove")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}