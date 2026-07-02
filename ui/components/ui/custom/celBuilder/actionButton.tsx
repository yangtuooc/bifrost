/**
 * CEL Rule Builder 的操作按钮。
 * 用于 query builder 中的添加/移除操作。
 */

import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionProps } from "react-querybuilder";

export function ActionButton({ handleOnClick, label, className, title }: ActionProps) {
	const { t } = useTranslation();
	const labelStr = typeof label === "string" ? label : "";
	const labelLower = labelStr.toLowerCase();
	const isAddButton = labelLower.includes("add");
	const isRemoveButton =
		labelLower.includes("remove") ||
		labelLower === "x" ||
		labelStr === "x" ||
		label?.toString().toLowerCase() === "x" ||
		title === "Remove rule" ||
		title === "Remove group";

	// 仅图标的移除按钮需要可访问名称。
	const iconOnly = isRemoveButton;
	const ariaLabel = iconOnly ? t("common.actions.remove") : undefined;

	return (
		<Button
			type="button"
			onClick={(e) => handleOnClick(e)}
			variant={isRemoveButton ? "ghost" : "outline"}
			size="sm"
			className={className}
			aria-label={ariaLabel}
		>
			{isRemoveButton && <X className="h-4 w-4" />}
			{isAddButton && <Plus className="mr-1 h-4 w-4" />}
			{!isRemoveButton && label}
		</Button>
	);
}