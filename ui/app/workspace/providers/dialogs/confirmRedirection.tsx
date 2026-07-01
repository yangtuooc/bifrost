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

interface Props {
	show: boolean;
	onContinue: () => void;
	onCancel: () => void;
}

export default function ConfirmRedirectionDialog({ show, onContinue, onCancel }: Props) {
	const { t } = useTranslation();

	return (
		<AlertDialog open={show}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("providers.redirectionDialog.title")}</AlertDialogTitle>
					<AlertDialogDescription>{t("providers.redirectionDialog.description")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="mt-4">
					<AlertDialogCancel onClick={onCancel}>{t("common.actions.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							onContinue();
						}}
					>
						{t("common.actions.continue")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}