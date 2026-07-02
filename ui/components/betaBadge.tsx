import { useTranslation } from "react-i18next";
import { Badge } from "./ui/badge";

export default function BetaBadge() {
	const { t } = useTranslation();

	return <Badge variant="secondary">{t("common.status.beta")}</Badge>;
}