import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";

export function LanguageToggle() {
	const { i18n, t } = useTranslation();
	const currentLanguage = i18n.resolvedLanguage === "zh" ? "zh" : "en";

	const changeLanguage = (language: "en" | "zh") => {
		if (language === currentLanguage) return;
		void i18n.changeLanguage(language);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="hover:text-primary text-muted-foreground h-5 w-5 border-0 ring-offset-0 outline-none select-none focus-visible:ring-0"
					aria-label={t("common.language.toggle")}
				>
					<Languages className="h-5.5 w-5.5" strokeWidth={2} />
					<span className="sr-only">{t("common.language.label")}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => changeLanguage("en")} disabled={currentLanguage === "en"}>
					{t("common.language.english")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => changeLanguage("zh")} disabled={currentLanguage === "zh"}>
					{t("common.language.chinese")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}