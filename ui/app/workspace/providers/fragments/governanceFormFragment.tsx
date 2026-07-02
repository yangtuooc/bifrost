import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import MultiBudgetLines, { BudgetLineEntry } from "@/components/ui/multibudgets";
import NumberAndSelect from "@/components/ui/numberAndSelect";
import { DottedSeparator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supportsCalendarAlignment } from "@/lib/constants/governance";
import {
	getErrorMessage,
	useDeleteProviderGovernanceMutation,
	useGetProviderGovernanceQuery,
	useUpdateProviderGovernanceMutation,
} from "@/lib/store";
import { ModelProvider } from "@/lib/types/config";
import { CreateBudgetRequest, ProviderGovernance } from "@/lib/types/governance";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

interface GovernanceFormFragmentProps {
	provider: ModelProvider;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const createFormSchema = (t: Translate) =>
	z.object({
		budgets: z.array(
			z.object({
				id: z.string().optional(),
				max_limit: z
					.number({ error: t("providers.config.governance.validation.budgetLimitNumber") })
					.nonnegative(t("providers.config.governance.validation.budgetLimitNonNegative"))
					.optional(),
				reset_duration: z.string().min(1, t("providers.config.governance.validation.resetDurationRequired")),
			}),
		),
		calendarAligned: z.boolean(),
		tokenMaxLimit: z.number().int().nonnegative().optional(),
		tokenResetDuration: z.string().optional(),
		requestMaxLimit: z.number().int().nonnegative().optional(),
		requestResetDuration: z.string().optional(),
	});

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

const DEFAULT_GOVERNANCE_FORM_VALUES: FormData = {
	budgets: [],
	calendarAligned: false,
	tokenMaxLimit: undefined,
	tokenResetDuration: "1h",
	requestMaxLimit: undefined,
	requestResetDuration: "1h",
};

function governanceToFormValues(provGov: ProviderGovernance | undefined): FormData {
	if (!provGov) return DEFAULT_GOVERNANCE_FORM_VALUES;
	return {
		budgets: (provGov.budgets ?? []).map((b) => ({
			id: b.id,
			max_limit: b.max_limit,
			reset_duration: b.reset_duration,
		})),
		calendarAligned: provGov.calendar_aligned ?? false,
		tokenMaxLimit: provGov.rate_limit?.token_max_limit ?? undefined,
		tokenResetDuration: provGov.rate_limit?.token_reset_duration || "1h",
		requestMaxLimit: provGov.rate_limit?.request_max_limit ?? undefined,
		requestResetDuration: provGov.rate_limit?.request_reset_duration || "1h",
	};
}

export function GovernanceFormFragment({ provider }: GovernanceFormFragmentProps) {
	const { t } = useTranslation();
	const hasUpdateProviderAccess = useRbac(RbacResource.ModelProvider, RbacOperation.Update);
	const hasViewAccess = useRbac(RbacResource.Governance, RbacOperation.View);

	const { data: providerGovernanceData } = useGetProviderGovernanceQuery(undefined, {
		skip: !hasViewAccess,
		pollingInterval: 5000,
	});
	const [updateProviderGovernance, { isLoading: isUpdating }] = useUpdateProviderGovernanceMutation();
	const [deleteProviderGovernance, { isLoading: isDeleting }] = useDeleteProviderGovernanceMutation();

	const providerGovernance = providerGovernanceData?.providers?.find((p) => p.provider === provider.name);
	const hasExistingGovernance = !!((providerGovernance?.budgets?.length ?? 0) > 0 || providerGovernance?.rate_limit);
	const formSchema = useMemo(() => createFormSchema(t), [t]);

	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: DEFAULT_GOVERNANCE_FORM_VALUES,
	});

	const watchedBudgets = form.watch("budgets");
	const watchedCalendarAligned = form.watch("calendarAligned");
	const configuredBudgets = watchedBudgets.filter((b) => b.max_limit !== undefined && b.max_limit > 0);
	const showCalendarAlignment = configuredBudgets.some((b) => supportsCalendarAlignment(b.reset_duration));

	useEffect(() => {
		if (providerGovernance && !form.formState.isDirty) {
			form.reset(governanceToFormValues(providerGovernance));
		}
	}, [providerGovernance, form]);

	useEffect(() => {
		if (form.formState.isDirty) return;
		const newProvGov = providerGovernanceData?.providers?.find((p) => p.provider === provider.name);
		form.reset(governanceToFormValues(newProvGov));
	}, [provider.name, form]);

	// 当没有预算支持自然周期对齐时，清理陈旧的 calendarAligned，避免后续再次添加可对齐预算时预启用。
	useEffect(() => {
		if (!showCalendarAlignment && watchedCalendarAligned) {
			form.setValue("calendarAligned", false, { shouldDirty: true });
		}
	}, [showCalendarAlignment, watchedCalendarAligned, form]);

	const onSubmit = async (data: FormData) => {
		try {
			const validBudgets = data.budgets.filter((b) => b.max_limit !== undefined && b.max_limit > 0);
			const hasAlignableBudget = validBudgets.some((b) => supportsCalendarAlignment(b.reset_duration));
			const hadBudgets = (providerGovernance?.budgets?.length ?? 0) > 0;
			const hadRateLimit = !!providerGovernance?.rate_limit;
			const hasRateLimit = data.tokenMaxLimit !== undefined || data.requestMaxLimit !== undefined;

			let budgetsPayload: CreateBudgetRequest[] | undefined;
			if (validBudgets.length > 0) {
				budgetsPayload = validBudgets.map((b) => ({
					id: b.id,
					max_limit: b.max_limit!,
					reset_duration: b.reset_duration,
				}));
			} else if (hadBudgets) {
				budgetsPayload = [];
			}

			let rateLimitPayload:
				| {
						token_max_limit?: number | null;
						token_reset_duration?: string | null;
						request_max_limit?: number | null;
						request_reset_duration?: string | null;
				  }
				| undefined;
			if (hasRateLimit) {
				rateLimitPayload = {
					token_max_limit: data.tokenMaxLimit ?? null,
					token_reset_duration: data.tokenMaxLimit !== undefined ? data.tokenResetDuration || "1h" : null,
					request_max_limit: data.requestMaxLimit ?? null,
					request_reset_duration: data.requestMaxLimit !== undefined ? data.requestResetDuration || "1h" : null,
				};
			} else if (hadRateLimit) {
				rateLimitPayload = {};
			}

			await updateProviderGovernance({
				provider: provider.name,
				data: {
					budgets: budgetsPayload,
					...(budgetsPayload !== undefined ? { calendar_aligned: hasAlignableBudget && data.calendarAligned } : {}),
					rate_limit: rateLimitPayload,
				},
			}).unwrap();

			toast.success(t("providers.config.governance.toasts.saved"));
			form.reset(data);
		} catch (error) {
			toast.error(t("providers.config.governance.toasts.updateFailed"), {
				description: getErrorMessage(error),
			});
		}
	};

	const handleDelete = async () => {
		try {
			await deleteProviderGovernance(provider.name).unwrap();
			toast.success(t("providers.config.governance.toasts.removed"));
			form.reset(DEFAULT_GOVERNANCE_FORM_VALUES);
		} catch (error) {
			toast.error(t("providers.config.governance.toasts.removeFailed"), {
				description: getErrorMessage(error),
			});
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6">
				{/* 预算配置 */}
				<MultiBudgetLines
					data-testid="provider-governance-budgets"
					lines={watchedBudgets as BudgetLineEntry[]}
					onChange={(lines) => form.setValue("budgets", lines, { shouldDirty: true })}
				/>

				{/* 自然周期对齐：仅当预算使用 day/week/month/year 时展示。 */}
				{showCalendarAlignment && (
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<Label className="text-sm" htmlFor="provider-calendar-aligned">
								{t("providers.config.governance.alignToCalendarCycle")}
							</Label>
							<p className="text-muted-foreground text-xs">{t("providers.config.governance.alignToCalendarCycleDescription")}</p>
						</div>
						<Switch
							id="provider-calendar-aligned"
							data-testid="provider-governance-calendar-aligned-switch"
							checked={watchedCalendarAligned}
							onCheckedChange={(checked) => form.setValue("calendarAligned", checked, { shouldDirty: true })}
						/>
					</div>
				)}

				<DottedSeparator />

				{/* Rate limit 配置 */}
				<div className="space-y-4">
					<Label className="text-sm font-medium">{t("providers.config.governance.rateLimitingTitle")}</Label>
					<NumberAndSelect
						id="providerTokenMaxLimit"
						labelClassName="font-normal"
						label={t("providers.config.governance.maximumTokens")}
						value={form.watch("tokenMaxLimit")}
						selectValue={form.watch("tokenResetDuration") || "1h"}
						onChangeNumber={(value) => form.setValue("tokenMaxLimit", value, { shouldDirty: true })}
						onChangeSelect={(value) => form.setValue("tokenResetDuration", value, { shouldDirty: true })}
					/>
					<NumberAndSelect
						id="providerRequestMaxLimit"
						labelClassName="font-normal"
						label={t("providers.config.governance.maximumRequests")}
						value={form.watch("requestMaxLimit")}
						selectValue={form.watch("requestResetDuration") || "1h"}
						onChangeNumber={(value) => form.setValue("requestMaxLimit", value, { shouldDirty: true })}
						onChangeSelect={(value) => form.setValue("requestResetDuration", value, { shouldDirty: true })}
					/>
				</div>

				{/* 当前用量：仅在 governance 已存在时展示。 */}
				{hasExistingGovernance && (
					<>
						<DottedSeparator />
						<div className="space-y-4">
							<Label className="text-sm font-medium">{t("providers.config.governance.currentUsage")}</Label>
							<div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg p-4">
								{providerGovernance?.budgets?.map((b) => (
									<div key={b.id} className="space-y-1">
										<p className="text-muted-foreground text-xs">
											{t("providers.config.governance.budgetWithDuration", { duration: b.reset_duration })}
										</p>
										<p className="text-sm font-medium">
											${b.current_usage.toFixed(2)} / ${b.max_limit.toFixed(2)}
										</p>
									</div>
								))}
								{providerGovernance?.rate_limit?.token_max_limit && (
									<div className="space-y-1">
										<p className="text-muted-foreground text-xs">{t("providers.config.governance.tokenUsage")}</p>
										<p className="text-sm font-medium">
											{providerGovernance.rate_limit.token_current_usage.toLocaleString()} /{" "}
											{providerGovernance.rate_limit.token_max_limit.toLocaleString()}
										</p>
									</div>
								)}
								{providerGovernance?.rate_limit?.request_max_limit && (
									<div className="space-y-1">
										<p className="text-muted-foreground text-xs">{t("providers.config.governance.requestUsage")}</p>
										<p className="text-sm font-medium">
											{providerGovernance.rate_limit.request_current_usage.toLocaleString()} /{" "}
											{providerGovernance.rate_limit.request_max_limit.toLocaleString()}
										</p>
									</div>
								)}
							</div>
						</div>
					</>
				)}

				{/* 表单操作 */}
				<div className="mb-6 flex justify-end space-x-2">
					<Button
						type="button"
						variant="outline"
						onClick={handleDelete}
						disabled={!hasUpdateProviderAccess || isDeleting || !hasExistingGovernance}
					>
						{t("providers.config.shared.actions.removeConfiguration")}
					</Button>
					<Button type="submit" disabled={!form.formState.isDirty || !hasUpdateProviderAccess || isUpdating} isLoading={isUpdating}>
						{t("providers.config.governance.actions.save")}
					</Button>
				</div>
			</form>
		</Form>
	);
}