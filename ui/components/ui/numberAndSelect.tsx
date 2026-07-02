import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cleanNumericInput } from "@/lib/utils/strings";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const resetDurationLabelKeys: Record<string, string> = {
	"1m": "common.resetDurations.everyMinute",
	"5m": "common.resetDurations.everyFiveMinutes",
	"15m": "common.resetDurations.everyFifteenMinutes",
	"30m": "common.resetDurations.everyThirtyMinutes",
	"1h": "common.resetDurations.hourly",
	"6h": "common.resetDurations.everySixHours",
	"1d": "common.resetDurations.daily",
	"1w": "common.resetDurations.weekly",
	"1M": "common.resetDurations.monthly",
};

const formatOptionLabel = (option: { label: string; value: string }, t: Translate) => {
	const labelKey = resetDurationLabelKeys[option.value];
	return labelKey ? t(labelKey) : option.label;
};

const NumberAndSelect = ({
	id,
	label,
	value,
	selectValue,
	onChangeNumber,
	onChangeSelect,
	options,
	labelClassName,
	placeholder = "100",
	dataTestId,
	inputClassName,
}: {
	id: string;
	label: string;
	value: number | undefined;
	onChangeNumber: (value: number | undefined) => void;
	selectValue?: string;
	onChangeSelect?: (value: string) => void;
	options?: { label: string; value: string }[];
	labelClassName?: string;
	placeholder?: string;
	dataTestId?: string;
	inputClassName?: string;
}) => {
	const { t } = useTranslation();

	// 保留字符串态，允许用户输入 "0." 或空值这类中间状态。
	const [displayValue, setDisplayValue] = useState(value !== undefined ? String(value) : "");

	// 仅在外部 value 变化时同步，避免每次按键都覆盖输入态。
	useEffect(() => {
		const displayNum = displayValue === "" ? undefined : parseFloat(displayValue);
		if (value !== displayNum) {
			setDisplayValue(value !== undefined ? String(value) : "");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value]);

	const showSelect = selectValue !== undefined && onChangeSelect && options;

	const numberInput = (
		<>
			<Label htmlFor={id} className={labelClassName}>
				{label}
			</Label>
			<Input
				id={id}
				data-testid={dataTestId}
				placeholder={placeholder}
				className={inputClassName}
				value={displayValue}
				onChange={(e) => {
					const cleaned = cleanNumericInput(e.target.value);
					setDisplayValue(cleaned);
					if (cleaned === "" || cleaned === ".") {
						onChangeNumber(undefined);
					} else {
						const n = Number(cleaned);
						if (!isNaN(n)) {
							onChangeNumber(n);
						}
					}
				}}
				onBlur={() => {
					const trimmed = displayValue.trim();
					if (trimmed === "" || trimmed === ".") {
						setDisplayValue("");
						onChangeNumber(undefined);
					} else {
						const num = Number(trimmed);
						if (!isNaN(num)) {
							setDisplayValue(String(num));
							onChangeNumber(num);
						} else {
							setDisplayValue("");
							onChangeNumber(undefined);
						}
					}
				}}
				type="text"
			/>
		</>
	);

	if (!showSelect) {
		return <div className="space-y-2">{numberInput}</div>;
	}

	return (
		<div className="flex w-full items-center justify-between gap-4">
			<div className="grow space-y-2">{numberInput}</div>
			<div className="w-40 space-y-2">
				<Label htmlFor={`${id}-select`} className={labelClassName}>
					{t("common.forms.resetPeriod")}
				</Label>
				<Select value={selectValue} onValueChange={(value) => onChangeSelect(value as string)}>
					<SelectTrigger className="m-0 w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options
							.filter((option) => option.value)
							.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{formatOptionLabel(option, t)}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

export default NumberAndSelect;