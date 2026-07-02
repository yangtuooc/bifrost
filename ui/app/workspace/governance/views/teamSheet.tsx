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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumberAndSelect from "@/components/ui/numberAndSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetDurationOptions, supportsCalendarAlignment } from "@/lib/constants/governance";
import { getErrorMessage, useCreateTeamMutation, useUpdateTeamMutation } from "@/lib/store";
import { CreateTeamRequest, Customer, Team, UpdateTeamRequest } from "@/lib/types/governance";
import { formatCurrency } from "@/lib/utils/governance";
import { Validator } from "@/lib/utils/validation";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { formatDistanceToNow } from "date-fns";
import isEqual from "lodash.isequal";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";

interface TeamSheetProps {
	team?: Team | null;
	customers: Customer[];
	onSave: () => void;
	onCancel: () => void;
}

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

const formatResetDuration = (duration: string, t: Translate) => {
	const key = resetDurationLabelKeys[duration];
	return key ? t(key) : resetDurationOptions.find((option) => option.value === duration)?.label || duration;
};

// One editable budget row; teams own multiple, each keyed by reset_duration
// on the wire. The client-side `id` is stable across re-renders and equals
// the persisted budget's id for existing rows, or a fresh UUID for new ones —
// used as the React key and for matching against `team.budgets` when we need
// to distinguish "already persisted" from "just added in the form".
interface TeamBudgetRow {
	id: string;
	maxLimit: number | undefined;
	resetDuration: string;
}

interface TeamFormData {
	name: string;
	customerId: string;
	// Multi-budget: each row has a unique reset_duration on submit
	budgets: TeamBudgetRow[];
	// Rate Limit
	tokenMaxLimit: number | undefined;
	tokenResetDuration: string;
	requestMaxLimit: number | undefined;
	requestResetDuration: string;
	// Team-wide: applies to all team budgets and the team rate limit
	calendarAligned: boolean;
	isDirty: boolean;
}

// Helper function to create initial state
const createInitialState = (team?: Team | null): Omit<TeamFormData, "isDirty"> => {
	return {
		name: team?.name || "",
		customerId: team?.customer_id || "",
		budgets:
			team?.budgets?.map((b) => ({
				id: b.id,
				maxLimit: b.max_limit,
				resetDuration: b.reset_duration,
			})) ?? [],
		// Rate Limit
		tokenMaxLimit: team?.rate_limit?.token_max_limit ?? undefined,
		tokenResetDuration: team?.rate_limit?.token_reset_duration || "1h",
		requestMaxLimit: team?.rate_limit?.request_max_limit ?? undefined,
		requestResetDuration: team?.rate_limit?.request_reset_duration || "1h",
		calendarAligned: team?.calendar_aligned ?? false,
	};
};

export default function TeamSheet({ team, customers, onSave, onCancel }: TeamSheetProps) {
	const { t } = useTranslation();
	const isEditing = !!team;
	const [initialState, setInitialState] = useState<Omit<TeamFormData, "isDirty">>(createInitialState(team));
	const [formData, setFormData] = useState<TeamFormData>({
		...initialState,
		isDirty: false,
	});
	const [nameError, setNameError] = useState<string | null>(null);

	useEffect(() => {
		const nextInitial = createInitialState(team);
		setInitialState(nextInitial);
		setFormData({ ...nextInitial, isDirty: false });
		setNameError(null);
		setShowCalendarAlignWarning(false);
	}, [team]);

	const hasCreateAccess = useRbac(RbacResource.Teams, RbacOperation.Create);
	const hasUpdateAccess = useRbac(RbacResource.Teams, RbacOperation.Update);
	const hasPermission = isEditing ? hasUpdateAccess : hasCreateAccess;

	// RTK Query hooks
	const [createTeam, { isLoading: isCreating }] = useCreateTeamMutation();
	const [updateTeam, { isLoading: isUpdating }] = useUpdateTeamMutation();
	const loading = isCreating || isUpdating;

	// Team-wide calendar-align toggle: confirmation only fires on the off→on
	// transition for an existing team (mirrors the VK sheet behavior).
	const [showCalendarAlignWarning, setShowCalendarAlignWarning] = useState(false);

	const updateBudgetRow = (idx: number, patch: Partial<TeamBudgetRow>) => {
		setFormData((prev) => {
			const next = prev.budgets.map((row, i) => (i === idx ? { ...row, ...patch } : row));
			return { ...prev, budgets: next };
		});
	};

	const addBudgetRow = () => {
		setFormData((prev) => ({
			...prev,
			budgets: [
				...prev.budgets,
				{
					id: uuid(),
					maxLimit: undefined,
					resetDuration: "1M",
				},
			],
		}));
	};

	const removeBudgetRow = (idx: number) => {
		setFormData((prev) => ({
			...prev,
			budgets: prev.budgets.filter((_, i) => i !== idx),
		}));
	};

	const handleCalendarAlignedChange = (checked: boolean) => {
		// Warn only on the persisted false→true transition. Toggling off then
		// back on within the same edit session doesn't reset on save (the backend
		// snap also runs only on the persisted transition), so no warning needed.
		if (checked && isEditing && !initialState.calendarAligned) {
			setShowCalendarAlignWarning(true);
		} else {
			updateField("calendarAligned", checked);
		}
	};

	// Track isDirty state
	useEffect(() => {
		const currentData: Omit<TeamFormData, "isDirty"> = {
			name: formData.name,
			customerId: formData.customerId,
			budgets: formData.budgets,
			tokenMaxLimit: formData.tokenMaxLimit,
			tokenResetDuration: formData.tokenResetDuration,
			requestMaxLimit: formData.requestMaxLimit,
			requestResetDuration: formData.requestResetDuration,
			calendarAligned: formData.calendarAligned,
		};
		setFormData((prev) => ({
			...prev,
			isDirty: !isEqual(initialState, currentData),
		}));
	}, [
		formData.name,
		formData.customerId,
		formData.budgets,
		formData.tokenMaxLimit,
		formData.tokenResetDuration,
		formData.requestMaxLimit,
		formData.requestResetDuration,
		formData.calendarAligned,
		initialState,
	]);

	const tokenMaxLimitNum = formData.tokenMaxLimit;
	const requestMaxLimitNum = formData.requestMaxLimit;

	// Validation
	const validator = useMemo(() => {
		// Per-row budget validation plus cross-row uniqueness on reset_duration.
		const budgetValidators = formData.budgets.flatMap((row, idx) => {
			if (row.maxLimit === undefined || row.maxLimit === null) return [];
			return [
				Validator.minValue(row.maxLimit, 0.01, t("governance.teams.validation.budgetMaxLimitMin", { index: idx + 1 })),
				Validator.required(row.resetDuration, t("governance.teams.validation.budgetResetDurationRequired", { index: idx + 1 })),
			];
		});
		const populatedDurations = formData.budgets.filter((r) => r.maxLimit !== undefined && r.maxLimit !== null).map((r) => r.resetDuration);
		const uniqueDurations = new Set(populatedDurations).size;

		return new Validator([
			Validator.required(formData.name.trim(), t("governance.teams.validation.nameRequired")),
			Validator.custom(formData.isDirty, t("governance.common.validation.noChanges")),
			...budgetValidators,
			Validator.custom(uniqueDurations === populatedDurations.length, t("governance.common.validation.distinctBudgetResetDuration")),

			// Rate limit validation - token limits
			...(formData.tokenMaxLimit !== undefined && formData.tokenMaxLimit !== null
				? [
						Validator.minValue(tokenMaxLimitNum || 0, 1, t("governance.common.validation.tokenMaxLimitMin")),
						Validator.required(formData.tokenResetDuration, t("governance.common.validation.tokenResetDurationRequired")),
					]
				: []),

			// Rate limit validation - request limits
			...(formData.requestMaxLimit !== undefined && formData.requestMaxLimit !== null
				? [
						Validator.minValue(requestMaxLimitNum || 0, 1, t("governance.common.validation.requestMaxLimitMin")),
						Validator.required(formData.requestResetDuration, t("governance.common.validation.requestResetDurationRequired")),
					]
				: []),
		]);
	}, [formData, t, tokenMaxLimitNum, requestMaxLimitNum]);

	const updateField = <K extends keyof TeamFormData>(field: K, value: TeamFormData[K]) => {
		if (field === "name") {
			setNameError(null);
		}
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validator.isValid()) {
			toast.error(validator.getFirstError());
			return;
		}

		// Serialize budget rows whose max_limit was filled in — rows left blank
		// are silently dropped (the backend treats the slice as authoritative).
		const submittableBudgets = formData.budgets
			.filter((r) => r.maxLimit !== undefined && r.maxLimit !== null)
			.map((r) => ({
				max_limit: r.maxLimit as number,
				reset_duration: r.resetDuration,
			}));

		try {
			if (isEditing && team) {
				// Update existing team
				const updateData: UpdateTeamRequest = {
					name: formData.name,
					customer_id: formData.customerId || undefined,
					// Always send: backend treats `budgets` as a full replacement.
					budgets: submittableBudgets,
					// Team-wide setting that governs both team budgets and the team rate limit.
					calendar_aligned: formData.calendarAligned,
				};

				// Detect rate limit changes using had/has pattern
				const hadRateLimit = !!team.rate_limit;
				const hasRateLimit =
					(tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null) ||
					(requestMaxLimitNum !== undefined && requestMaxLimitNum !== null);
				if (hasRateLimit) {
					updateData.rate_limit = {
						token_max_limit: tokenMaxLimitNum,
						token_reset_duration: tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null ? formData.tokenResetDuration : undefined,
						request_max_limit: requestMaxLimitNum,
						request_reset_duration:
							requestMaxLimitNum !== undefined && requestMaxLimitNum !== null ? formData.requestResetDuration : undefined,
					};
				} else if (hadRateLimit) {
					updateData.rate_limit = {} as UpdateTeamRequest["rate_limit"];
				}

				await updateTeam({ teamId: team.id, data: updateData }).unwrap();
				toast.success(t("governance.teams.toasts.updated"));
			} else {
				// Create new team
				const createData: CreateTeamRequest = {
					name: formData.name,
					customer_id: formData.customerId || undefined,
					budgets: submittableBudgets.length > 0 ? submittableBudgets : undefined,
					// Team-wide setting that governs both team budgets and the team rate limit.
					calendar_aligned: formData.calendarAligned,
				};

				// Add rate limit if enabled (token or request limits)
				if (
					(tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null) ||
					(requestMaxLimitNum !== undefined && requestMaxLimitNum !== null)
				) {
					createData.rate_limit = {
						token_max_limit: tokenMaxLimitNum,
						token_reset_duration: tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null ? formData.tokenResetDuration : undefined,
						request_max_limit: requestMaxLimitNum,
						request_reset_duration:
							requestMaxLimitNum !== undefined && requestMaxLimitNum !== null ? formData.requestResetDuration : undefined,
					};
				}

				await createTeam(createData).unwrap();
				toast.success(t("governance.teams.toasts.created"));
			}

			onSave();
		} catch (error: any) {
			if (error?.status === 409) {
				setNameError(getErrorMessage(error));
				return;
			}
			toast.error(getErrorMessage(error));
		}
	};

	return (
		<Sheet open onOpenChange={(open) => !open && onCancel()}>
			<SheetContent
				className="flex w-full flex-col gap-4 overflow-x-hidden p-0 pt-4"
				data-testid="team-sheet-content"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={() => onCancel()}
			>
				<SheetHeader className="flex flex-col items-start px-0 py-4" headerClassName="mb-0 sticky -top-4 bg-card z-10 px-8">
					<SheetTitle className="flex items-center gap-2">
						{isEditing ? t("governance.teams.sheet.editTitle") : t("governance.teams.sheet.createTitle")}
					</SheetTitle>
					<SheetDescription>
						{isEditing ? t("governance.teams.sheet.editDescription") : t("governance.teams.sheet.createDescription")}
					</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit} className="flex h-full flex-col gap-6">
					<div className="grow space-y-6 px-8">
						{/* Basic Information */}
						<div className="flex flex-col gap-6">
							<div className="space-y-2">
								<Label htmlFor="name">{t("governance.teams.sheet.name")}</Label>
								<Input
									id="name"
									placeholder={t("governance.teams.sheet.namePlaceholder")}
									value={formData.name}
									maxLength={50}
									onChange={(e) => updateField("name", e.target.value)}
									data-testid="team-name-input"
								/>
								{nameError && <p className="text-destructive text-sm">{nameError}</p>}
							</div>

							{/* Customer Assignment */}
							{customers?.length > 0 && (
								<div className="space-y-2">
									<Label htmlFor="customer">{t("governance.teams.sheet.customerOptional")}</Label>
									<Select
										value={formData.customerId || "__none__"}
										onValueChange={(value) => updateField("customerId", value === "__none__" ? "" : value)}
									>
										<SelectTrigger id="customer" className="w-full" data-testid="team-customer-select-trigger">
											<SelectValue placeholder={t("governance.teams.sheet.selectCustomer")} />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__" data-testid="team-customer-option-none">
												{t("common.status.none")}
											</SelectItem>
											{customers.map((customer) => (
												<SelectItem key={customer.id} value={customer.id} data-testid={`team-customer-option-${customer.id}`}>
													{customer.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-muted-foreground text-sm">{t("governance.teams.sheet.customerHint")}</p>
								</div>
							)}
						</div>

						{/* Multi-budget configuration: one row per budget, each keyed by reset_duration */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label>{t("governance.common.fields.budgets")}</Label>
								<button
									type="button"
									onClick={addBudgetRow}
									className="text-primary text-xs font-medium hover:underline"
									data-testid="team-add-budget-btn"
								>
									{t("governance.common.actions.addBudget")}
								</button>
							</div>
							{formData.budgets.length === 0 && <p className="text-muted-foreground text-xs">{t("governance.teams.sheet.noBudgets")}</p>}
							{formData.budgets.map((row, idx) => (
								<div key={row.id} className="space-y-2 rounded-md border p-3" data-testid={`team-budget-row-${idx}`}>
									<div className="flex items-start gap-2">
										<div className="flex-1">
											<NumberAndSelect
												id={`budgetMaxLimit-${idx}`}
												label={t("governance.teams.sheet.budgetRowLabel", { index: idx + 1 })}
												value={row.maxLimit}
												selectValue={row.resetDuration}
												onChangeNumber={(value) => updateBudgetRow(idx, { maxLimit: value })}
												onChangeSelect={(value) => updateBudgetRow(idx, { resetDuration: value })}
												options={resetDurationOptions}
												dataTestId={`budget-max-limit-input-${idx}`}
											/>
										</div>
										<button
											type="button"
											onClick={() => removeBudgetRow(idx)}
											className="text-muted-foreground hover:text-destructive mt-6 text-xs font-medium"
											data-testid={`team-remove-budget-btn-${idx}`}
										>
											{t("governance.common.actions.remove")}
										</button>
									</div>
								</div>
							))}
						</div>

						{/* Rate Limit Configuration - Token Limits */}
						<NumberAndSelect
							id="tokenMaxLimit"
							label={t("governance.common.fields.maximumTokens")}
							value={formData.tokenMaxLimit}
							selectValue={formData.tokenResetDuration}
							onChangeNumber={(value) => updateField("tokenMaxLimit", value)}
							onChangeSelect={(value) => updateField("tokenResetDuration", value)}
							options={resetDurationOptions}
						/>

						{/* Rate Limit Configuration - Request Limits */}
						<NumberAndSelect
							id="requestMaxLimit"
							label={t("governance.common.fields.maximumRequests")}
							value={formData.requestMaxLimit}
							selectValue={formData.requestResetDuration}
							onChangeNumber={(value) => updateField("requestMaxLimit", value)}
							onChangeSelect={(value) => updateField("requestResetDuration", value)}
							options={resetDurationOptions}
						/>

						{/* Calendar alignment — team-wide setting that applies to all team budgets and the team rate limit */}
						{(() => {
							const hasAlignableBudget = formData.budgets.some(
								(b) => b.maxLimit !== undefined && b.maxLimit !== null && supportsCalendarAlignment(b.resetDuration),
							);
							const hasAlignableRateLimit =
								(formData.tokenMaxLimit !== undefined &&
									formData.tokenMaxLimit !== null &&
									supportsCalendarAlignment(formData.tokenResetDuration)) ||
								(formData.requestMaxLimit !== undefined &&
									formData.requestMaxLimit !== null &&
									supportsCalendarAlignment(formData.requestResetDuration));
							if (!hasAlignableBudget && !hasAlignableRateLimit) return null;
							return (
								<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
									<div className="space-y-0.5">
										<Label htmlFor="team-calendar-aligned-toggle" className="text-sm font-normal">
											{t("governance.common.calendarAlign.label")}
										</Label>
										<p className="text-muted-foreground text-xs">{t("governance.common.calendarAlign.description")}</p>
									</div>
									<Switch
										id="team-calendar-aligned-toggle"
										checked={formData.calendarAligned}
										onCheckedChange={handleCalendarAlignedChange}
										data-testid="team-calendar-aligned-toggle"
									/>
								</div>
							);
						})()}

						{/* Warning dialog shown when enabling calendar alignment on an existing team */}
						<AlertDialog open={showCalendarAlignWarning} onOpenChange={setShowCalendarAlignWarning}>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t("governance.common.calendarAlign.warningTitle")}</AlertDialogTitle>
									<AlertDialogDescription>
										{t("governance.common.calendarAlign.warningDescription", { entity: t("governance.entities.team") })}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel data-testid="team-calendar-align-cancel-btn">{t("common.actions.cancel")}</AlertDialogCancel>
									<AlertDialogAction
										data-testid="team-calendar-align-enable-btn"
										onClick={() => {
											updateField("calendarAligned", true);
											setShowCalendarAlignWarning(false);
										}}
									>
										{t("governance.common.calendarAlign.enable")}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>

						{/* Current Usage Section (only shown when editing with existing limits) */}
						{isEditing && ((team?.budgets && team.budgets.length > 0) || team?.rate_limit) && (
							<div className="bg-muted/50 space-y-4 rounded-lg border p-4">
								<p className="text-sm font-medium">{t("governance.common.fields.currentUsage")}</p>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									{team?.budgets?.map((b) => (
										<div key={b.id} className="space-y-1">
											<p className="text-muted-foreground text-xs">
												{t("governance.common.fields.budgetWithDuration", { duration: formatResetDuration(b.reset_duration, t) })}
											</p>
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm">
													{formatCurrency(b.current_usage)} / {formatCurrency(b.max_limit)}
												</span>
												<Badge variant={b.max_limit > 0 && b.current_usage >= b.max_limit ? "destructive" : "default"} className="text-xs">
													{b.max_limit > 0 ? Math.round((b.current_usage / b.max_limit) * 100) : 0}%
												</Badge>
											</div>
											<p className="text-muted-foreground text-xs">
												{t("governance.common.fields.lastReset", {
													time: formatDistanceToNow(new Date(b.last_reset), {
														addSuffix: true,
													}),
												})}
											</p>
										</div>
									))}
									{team?.rate_limit?.token_max_limit && (
										<div className="space-y-1">
											<p className="text-muted-foreground text-xs">{t("governance.common.fields.tokens")}</p>
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm">
													{team.rate_limit.token_current_usage.toLocaleString()} / {team.rate_limit.token_max_limit.toLocaleString()}
												</span>
												<Badge
													variant={
														team.rate_limit.token_max_limit > 0 && team.rate_limit.token_current_usage >= team.rate_limit.token_max_limit
															? "destructive"
															: "default"
													}
													className="text-xs"
												>
													{team.rate_limit.token_max_limit > 0
														? Math.round((team.rate_limit.token_current_usage / team.rate_limit.token_max_limit) * 100)
														: 0}
													%
												</Badge>
											</div>
											<p className="text-muted-foreground text-xs">
												{t("governance.common.fields.lastReset", {
													time: formatDistanceToNow(new Date(team.rate_limit.token_last_reset), { addSuffix: true }),
												})}
											</p>
										</div>
									)}
									{team?.rate_limit?.request_max_limit && (
										<div className="space-y-1">
											<p className="text-muted-foreground text-xs">{t("governance.common.fields.requests")}</p>
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm">
													{team.rate_limit.request_current_usage.toLocaleString()} / {team.rate_limit.request_max_limit.toLocaleString()}
												</span>
												<Badge
													variant={
														team.rate_limit.request_max_limit > 0 &&
														team.rate_limit.request_current_usage >= team.rate_limit.request_max_limit
															? "destructive"
															: "default"
													}
													className="text-xs"
												>
													{team.rate_limit.request_max_limit > 0
														? Math.round((team.rate_limit.request_current_usage / team.rate_limit.request_max_limit) * 100)
														: 0}
													%
												</Badge>
											</div>
											<p className="text-muted-foreground text-xs">
												{t("governance.common.fields.lastReset", {
													time: formatDistanceToNow(new Date(team.rate_limit.request_last_reset), { addSuffix: true }),
												})}
											</p>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="border-border bg-card sticky bottom-0 z-10 border-t px-8 py-4">
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
								{t("common.actions.cancel")}
							</Button>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-block">
											<Button type="submit" disabled={loading || !validator.isValid() || !hasPermission} data-testid="team-save-btn">
												{loading
													? t("common.actions.saving")
													: isEditing
														? t("governance.teams.sheet.updateAction")
														: t("governance.teams.sheet.createAction")}
											</Button>
										</span>
									</TooltipTrigger>
									{(loading || !validator.isValid() || !hasPermission) && (
										<TooltipContent>
											<p>
												{!hasPermission
													? t("governance.common.validation.noPermission")
													: loading
														? t("common.actions.saving")
														: validator.getFirstError() || t("governance.common.validation.fixErrors")}
											</p>
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}