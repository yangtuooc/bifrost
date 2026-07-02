import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import NumberAndSelect from "@/components/ui/numberAndSelect";
import { resetDurationOptions } from "@/lib/constants/governance";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export interface BudgetLineEntry {
	id?: string;
	max_limit?: number;
	reset_duration: string;
}

interface MultiBudgetLinesProps {
	"data-testid"?: string;
	label?: string;
	lines: BudgetLineEntry[];
	onChange: (lines: BudgetLineEntry[]) => void;
	options?: { label: string; value: string }[];
	onReset?: () => void;
	showReset?: boolean;
}

export default function MultiBudgetLines({
	"data-testid": testId,
	label,
	lines,
	onChange,
	options = resetDurationOptions,
	onReset,
	showReset,
}: MultiBudgetLinesProps) {
	const { t } = useTranslation();

	// 统计已使用的重置周期，用于检测重复预算行。
	const usedDurations = useMemo(() => {
		const counts = new Map<string, number>();
		for (const line of lines) {
			counts.set(line.reset_duration, (counts.get(line.reset_duration) || 0) + 1);
		}
		return counts;
	}, [lines]);

	function addLine() {
		// 优先选择第一个未使用周期，兜底使用第一个可选项。
		const usedSet = new Set(lines.map((l) => l.reset_duration));
		const available = options.find((o) => !usedSet.has(o.value));
		onChange([
			...lines,
			{
				max_limit: undefined,
				reset_duration: available?.value ?? options[0]?.value ?? "",
			},
		]);
	}

	function removeLine(index: number) {
		onChange(lines.filter((_, i) => i !== index));
	}

	function updateMaxLimit(index: number, value: number | undefined) {
		const updated = [...lines];
		updated[index] = { ...updated[index], max_limit: value };
		onChange(updated);
	}

	function updateResetDuration(index: number, value: string) {
		const updated = [...lines];
		updated[index] = { ...updated[index], reset_duration: value };
		onChange(updated);
	}

	return (
		<div className="space-y-3" data-testid={testId}>
			<div className="flex items-center justify-between">
				<Label className="text-sm font-medium">{label ?? t("common.budgets.configuration")}</Label>
				<div className="flex items-center gap-2">
					{onReset && (showReset ?? true) && (
						<Button data-testid={`${testId}-reset-btn`} type="button" variant="ghost" size="sm" onClick={onReset}>
							<RotateCcw className="mr-1 h-3 w-3" />
							{t("common.actions.reset")}
						</Button>
					)}
					<Button data-testid={`${testId}-add-btn`} variant="outline" size="sm" type="button" onClick={addLine}>
						<Plus className="mr-1 h-3 w-3" />
						{t("common.budgets.add")}
					</Button>
				</div>
			</div>

			{lines.length === 0 && (
				<div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
					{t("common.budgets.noneConfigured")}
				</div>
			)}

			{lines.map((line, index) => {
				const isDuplicate = (usedDurations.get(line.reset_duration) || 0) > 1;
				return (
					<div key={index} className="space-y-1" data-testid={`${testId}-line-${index}`}>
						<div className="flex items-end gap-2">
							<div className="flex-1">
								<NumberAndSelect
									id={`${testId}-${index}`}
									dataTestId={`${testId}-amount-${index}`}
									labelClassName="font-normal"
									label={t("common.budgets.maximumSpendUsd")}
									value={line.max_limit}
									selectValue={line.reset_duration}
									onChangeNumber={(value) => updateMaxLimit(index, value)}
									onChangeSelect={(value) => updateResetDuration(index, value)}
									options={options}
								/>
							</div>
							<Button
								data-testid={`${testId}-remove-${index}`}
								aria-label={t("common.budgets.removeAria", { index: index + 1 })}
								variant="ghost"
								size="icon"
								type="button"
								className="text-destructive mb-0.5 h-8 w-8 shrink-0"
								onClick={() => removeLine(index)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
						{isDuplicate && <p className="text-destructive pl-0.5 text-xs">{t("common.budgets.duplicateResetPeriod")}</p>}
					</div>
				);
			})}
		</div>
	);
}