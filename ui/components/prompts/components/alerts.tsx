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
import { usePromptContext } from "../context";

export function DeleteFolderDialog() {
	const { t } = useTranslation();
	const { deleteFolderDialog, setDeleteFolderDialog, isDeletingFolder, handleDeleteFolder } = usePromptContext();

	return (
		<AlertDialog open={deleteFolderDialog.open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("prompts.dialogs.deleteFolderTitle")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("prompts.dialogs.deleteFolderDescription", { name: deleteFolderDialog.folder?.name })}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel
						data-testid="delete-folder-cancel"
						onClick={() => setDeleteFolderDialog({ open: false })}
						disabled={isDeletingFolder}
					>
						{t("common.actions.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction data-testid="delete-folder-confirm" onClick={handleDeleteFolder} disabled={isDeletingFolder}>
						{isDeletingFolder ? t("common.actions.deleting") : t("common.actions.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function DeletePromptDialog() {
	const { t } = useTranslation();
	const { deletePromptDialog, setDeletePromptDialog, isDeletingPrompt, handleDeletePrompt } = usePromptContext();

	return (
		<AlertDialog open={deletePromptDialog.open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("prompts.dialogs.deletePromptTitle")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("prompts.dialogs.deletePromptDescription", { name: deletePromptDialog.prompt?.name })}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel
						data-testid="delete-prompt-cancel"
						onClick={() => setDeletePromptDialog({ open: false })}
						disabled={isDeletingPrompt}
					>
						{t("common.actions.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction data-testid="delete-prompt-confirm" onClick={handleDeletePrompt} disabled={isDeletingPrompt}>
						{isDeletingPrompt ? t("common.actions.deleting") : t("common.actions.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}