/**
 * Routing Rule 抽屉
 * 创建/编辑路由规则表单
 */

import { Button } from "@/components/ui/button";
import { ComboboxSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelMultiselect } from "@/components/ui/modelMultiselect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProviderIconType, RenderProviderIcon } from "@/lib/constants/icons";
import { getProviderLabel } from "@/lib/constants/logs";
import { getErrorMessage } from "@/lib/store";
import { useGetCustomersQuery, useGetTeamsQuery, useGetVirtualKeysQuery } from "@/lib/store/apis/governanceApi";
import { useGetAllKeysQuery, useGetProvidersQuery } from "@/lib/store/apis/providersApi";
import { useCreateRoutingRuleMutation, useGetRoutingRulesQuery, useUpdateRoutingRuleMutation } from "@/lib/store/apis/routingRulesApi";
import {
	DEFAULT_ROUTING_RULE_FORM_DATA,
	DEFAULT_ROUTING_TARGET,
	ROUTING_RULE_SCOPES,
	RoutingRule,
	RoutingRuleFormData,
	RoutingTargetFormData,
} from "@/lib/types/routingRules";
import { validateRateLimitAndBudgetRules, validateRoutingRules } from "@/lib/utils/celConverterRouting";
import { normalizeRoutingRuleGroupQuery } from "@/lib/utils/routingRuleGroupQuery";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { Plus, Trash2, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RuleGroupType } from "react-querybuilder";
import { toast } from "sonner";

interface RoutingRuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingRule?: RoutingRule | null;
	onSuccess?: () => void;
}

const defaultQuery: RuleGroupType = {
	combinator: "and",
	rules: [],
};

// 懒加载 CEL builder，避免主包引入较重依赖树
const CELRuleBuilderLazy = lazy(() =>
	import("@/app/workspace/routing-rules/components/celBuilder/celRuleBuilder").then((mod) => ({
		default: mod.CELRuleBuilder,
	})),
);
const CELRuleBuilder = (props: React.ComponentProps<typeof CELRuleBuilderLazy>) => {
	const { t } = useTranslation();

	return (
		<Suspense fallback={<div className="text-sm text-gray-500">{t("routingRules.sheet.builder.loading")}</div>}>
			<CELRuleBuilderLazy {...props} />
		</Suspense>
	);
};

export function RoutingRuleSheet({ open, onOpenChange, editingRule, onSuccess }: RoutingRuleDialogProps) {
	const { t } = useTranslation();
	const { data: rulesData } = useGetRoutingRulesQuery();
	const rules = rulesData?.rules || [];
	const { data: providersData = [] } = useGetProvidersQuery();
	const { data: allKeysData = [] } = useGetAllKeysQuery();
	const { data: vksData = { virtual_keys: [] } } = useGetVirtualKeysQuery();
	const { data: teamsData = { teams: [], count: 0, total_count: 0, limit: 0, offset: 0 } } = useGetTeamsQuery();
	const { data: customersData = { customers: [] } } = useGetCustomersQuery();
	const [createRoutingRule, { isLoading: isCreating }] = useCreateRoutingRuleMutation();
	const [updateRoutingRule, { isLoading: isUpdating }] = useUpdateRoutingRuleMutation();

	// targets 和 query 是复杂嵌套结构，单独管理更清晰
	const [targets, setTargets] = useState<RoutingTargetFormData[]>([{ ...DEFAULT_ROUTING_TARGET }]);
	const [query, setQuery] = useState<RuleGroupType>(defaultQuery);
	const [builderKey, setBuilderKey] = useState(0);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<RoutingRuleFormData>({
		defaultValues: DEFAULT_ROUTING_RULE_FORM_DATA,
	});

	const isEditing = !!editingRule;
	const isLoading = isCreating || isUpdating;
	const canCreate = useRbac(RbacResource.RoutingRules, RbacOperation.Create);
	const canUpdate = useRbac(RbacResource.RoutingRules, RbacOperation.Update);
	const hasRequiredAccess = isEditing ? canUpdate : canCreate;
	const enabled = watch("enabled");
	const chainRule = watch("chain_rule");
	const scope = watch("scope");
	const scopeId = watch("scope_id");
	const fallbacks = watch("fallbacks");

	// 合并已配置 Provider 和规则中仍被引用的 Provider，确保编辑历史配置时选项仍可见
	const availableProviders = Array.from(
		new Set([
			...providersData.map((p) => p.name),
			...(targets.map((t) => t.provider).filter(Boolean) as string[]),
			...(rules.flatMap((r) => r.targets?.map((t) => t.provider).filter(Boolean) ?? []) as string[]),
			...rules.flatMap((r) => (r.fallbacks ?? []).map((f) => f.split("/")[0]?.trim()).filter(Boolean)),
		]),
	);
	const providerOptions = availableProviders.map((prov) => ({
		label: getProviderLabel(prov),
		value: prov,
		icon: <RenderProviderIcon provider={prov as ProviderIconType} size="sm" className="h-4 w-4" />,
	}));

	// 编辑对象变化时初始化表单数据
	useEffect(() => {
		if (editingRule) {
			setValue("id", editingRule.id);
			setValue("name", editingRule.name);
			setValue("description", editingRule.description);
			setValue("cel_expression", editingRule.cel_expression);
			setValue("fallbacks", editingRule.fallbacks || []);
			setValue("scope", editingRule.scope);
			setValue("scope_id", editingRule.scope_id || "");
			setValue("priority", editingRule.priority);
			setValue("enabled", editingRule.enabled);
			setValue("chain_rule", editingRule.chain_rule ?? false);
			if (editingRule.targets && editingRule.targets.length > 0) {
				setTargets(
					editingRule.targets.map((t) => ({
						...DEFAULT_ROUTING_TARGET,
						provider: t.provider || "",
						model: t.model || "",
						key_id: t.key_id || "",
						weight: t.weight,
					})),
				);
			} else {
				setTargets([{ ...DEFAULT_ROUTING_TARGET }]);
			}
			// 仅 react-querybuilder 形态的 query 有效，配置中可能存储其他 JSON
			setQuery(normalizeRoutingRuleGroupQuery(editingRule.query));
			setBuilderKey((prev) => prev + 1);
		} else {
			reset();
			setTargets([{ ...DEFAULT_ROUTING_TARGET }]);
			setQuery(defaultQuery);
			setBuilderKey((prev) => prev + 1);
		}
	}, [editingRule, open, setValue, reset]);

	const handleQueryChange = useCallback(
		(expression: string, newQuery: RuleGroupType) => {
			setValue("cel_expression", expression);
			setQuery(newQuery);
		},
		[setValue],
	);

	const addTarget = () => {
		const remaining = 1 - targets.reduce((sum, t) => sum + (t.weight || 0), 0);
		setTargets((prev) => [...prev, { ...DEFAULT_ROUTING_TARGET, weight: Math.max(0, parseFloat(remaining.toFixed(4))) }]);
	};

	const removeTarget = (index: number) => {
		setTargets((prev) => prev.filter((_, i) => i !== index));
	};

	const updateTarget = (index: number, field: keyof RoutingTargetFormData, value: string | number) => {
		setTargets((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
	};

	const totalWeight = targets.reduce((sum, t) => sum + (t.weight || 0), 0);

	const onSubmit = (data: RoutingRuleFormData) => {
		const scopeLabel = t(`routingRules.scopes.${data.scope}`, { defaultValue: data.scope });

		// 非 global scope 必须选择具体实体
		if (data.scope !== "global" && !data.scope_id?.trim()) {
			toast.error(t("routingRules.sheet.validation.scopeRequired", { scope: scopeLabel }));
			return;
		}

		// 校验目标配置
		if (targets.length === 0) {
			toast.error(t("routingRules.sheet.validation.targetRequired"));
			return;
		}
		for (const target of targets) {
			if (target.weight <= 0) {
				toast.error(t("routingRules.sheet.validation.targetWeightPositive"));
				return;
			}
		}
		if (Math.abs(totalWeight - 1) > 0.001) {
			toast.error(t("routingRules.sheet.validation.targetWeightSum", { total: totalWeight.toFixed(4) }));
			return;
		}

		// 校验路由规则中的 regex pattern
		const regexErrors = validateRoutingRules(query);
		if (regexErrors.length > 0) {
			toast.error(t("routingRules.sheet.validation.invalidRegex", { errors: regexErrors.join("\n") }));
			return;
		}

		// 校验 rate limit 和 budget 规则
		const rateLimitErrors = validateRateLimitAndBudgetRules(query);
		if (rateLimitErrors.length > 0) {
			toast.error(t("routingRules.sheet.validation.invalidRuleConfig", { errors: rateLimitErrors.join("\n") }));
			return;
		}

		// 过滤缺失 Provider 的 fallback
		const validFallbacks = (data.fallbacks || []).filter((fb) => {
			const provider = fb.split("/")[0]?.trim();
			return provider && provider.length > 0;
		});

		const payload = {
			name: data.name,
			description: data.description,
			cel_expression: data.cel_expression,
			targets: targets.map(({ provider, model, key_id, weight }) => ({
				provider: provider || undefined,
				model: model || undefined,
				key_id: key_id || undefined,
				weight,
			})),
			fallbacks: validFallbacks,
			scope: data.scope,
			scope_id: data.scope === "global" ? undefined : data.scope_id || undefined,
			priority: data.priority,
			enabled: data.enabled,
			chain_rule: data.chain_rule,
			query: query,
		};

		const submitPromise =
			isEditing && editingRule
				? updateRoutingRule({
						id: editingRule.id,
						data: payload,
					}).unwrap()
				: createRoutingRule(payload).unwrap();

		submitPromise
			.then(() => {
				toast.success(isEditing ? t("routingRules.sheet.toasts.updated") : t("routingRules.sheet.toasts.created"));
				reset();
				setTargets([{ ...DEFAULT_ROUTING_TARGET }]);
				setQuery(defaultQuery);
				setBuilderKey((prev) => prev + 1);
				onOpenChange(false);
				onSuccess?.();
			})
			.catch((error: any) => {
				toast.error(getErrorMessage(error));
			});
	};

	const handleCancel = () => {
		reset();
		setTargets([{ ...DEFAULT_ROUTING_TARGET }]);
		setQuery(defaultQuery);
		setBuilderKey((prev) => prev + 1);
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full min-w-1/2 flex-col gap-4 overflow-x-hidden p-0 pt-4">
				<SheetHeader className="flex flex-col items-start px-8 py-4" headerClassName="mb-0 sticky -top-4 bg-card z-10">
					<SheetTitle>{isEditing ? t("routingRules.sheet.title.edit") : t("routingRules.sheet.title.create")}</SheetTitle>
					<SheetDescription>
						{isEditing ? t("routingRules.sheet.title.editDescription") : t("routingRules.sheet.title.createDescription")}
					</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="flex grow flex-col">
					<div className="flex grow flex-col gap-6 px-8 pb-6">
						{/* 规则名称 */}
						<div className="space-y-3">
							<Label htmlFor="name">
								{t("routingRules.sheet.fields.ruleName")} <span className="text-red-500">*</span>
							</Label>
							<Input
								id="name"
								placeholder={t("routingRules.sheet.fields.ruleNamePlaceholder")}
								{...register("name", { required: t("routingRules.sheet.validation.ruleNameRequired"), maxLength: 255 })}
							/>
							{errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
						</div>

						{/* 描述 */}
						<div className="space-y-3">
							<Label htmlFor="description">{t("routingRules.sheet.fields.description")}</Label>
							<Textarea
								id="description"
								placeholder={t("routingRules.sheet.fields.descriptionPlaceholder")}
								rows={2}
								{...register("description")}
							/>
						</div>

						{/* 启用开关 */}
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<Label htmlFor="enabled">{t("routingRules.sheet.fields.enableRule")}</Label>
								<p className="text-muted-foreground text-sm">{t("routingRules.sheet.fields.enableRuleDescription")}</p>
							</div>
							<Switch id="enabled" checked={enabled} onCheckedChange={(checked) => setValue("enabled", checked)} />
						</div>

						{/* 链式规则开关 */}
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<Label htmlFor="chain_rule">{t("routingRules.sheet.fields.chainRule")}</Label>
								<p className="text-muted-foreground text-sm">{t("routingRules.sheet.fields.chainRuleDescription")}</p>
							</div>
							<Switch
								id="chain_rule"
								checked={chainRule}
								onCheckedChange={(checked) => setValue("chain_rule", checked)}
								data-testid="routing-rule-chain-rule-switch"
							/>
						</div>

						{/* Scope 与优先级 */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-3">
								<Label htmlFor="scope">{t("routingRules.sheet.fields.scope")}</Label>
								<Select
									value={scope}
									onValueChange={(value) => {
										setValue("scope", value as any);
										// scope 变化后清空已选实体
										setValue("scope_id", "");
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("routingRules.sheet.fields.selectScope")} />
									</SelectTrigger>
									<SelectContent>
										{ROUTING_RULE_SCOPES.map((scopeOption) => (
											<SelectItem key={scopeOption.value} value={scopeOption.value}>
												{t(`routingRules.scopes.${scopeOption.value}`, { defaultValue: scopeOption.label })}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-3">
								<Label htmlFor="priority">
									{t("routingRules.sheet.fields.priority")} <span className="text-red-500">*</span>
								</Label>
								<Input
									id="priority"
									type="number"
									min={0}
									max={1000}
									{...register("priority", {
										required: t("routingRules.sheet.validation.priorityRequired"),
										min: { value: 0, message: t("routingRules.sheet.validation.priorityMin") },
										max: { value: 1000, message: t("routingRules.sheet.validation.priorityMax") },
										valueAsNumber: true,
									})}
								/>
								<p className="text-muted-foreground text-xs">{t("routingRules.sheet.fields.priorityHint")}</p>
								{errors.priority && <p className="text-destructive text-sm">{errors.priority.message}</p>}
							</div>
						</div>

						{scope !== "global" && (
							<div className="space-y-2">
								<Label htmlFor="scope_id">
									{t(`routingRules.scopes.${scope}`, { defaultValue: scope })} <span className="text-red-500">*</span>
								</Label>
								{scope === "team" && teamsData.teams.length > 0 && (
									<ComboboxSelect
										options={teamsData.teams.map((team) => ({ label: team.name, value: team.id }))}
										value={scopeId || null}
										onValueChange={(value) => setValue("scope_id", value ?? "")}
										placeholder={t("routingRules.sheet.fields.selectTeam")}
										noPortal
									/>
								)}
								{scope === "customer" && customersData.customers.length > 0 && (
									<ComboboxSelect
										options={customersData.customers.map((customer) => ({ label: customer.name, value: customer.id }))}
										value={scopeId || null}
										onValueChange={(value) => setValue("scope_id", value ?? "")}
										placeholder={t("routingRules.sheet.fields.selectCustomer")}
										noPortal
									/>
								)}
								{scope === "virtual_key" && vksData.virtual_keys.length > 0 && (
									<ComboboxSelect
										options={vksData.virtual_keys.map((vk) => ({ label: vk.name, value: vk.id }))}
										value={scopeId || null}
										onValueChange={(value) => setValue("scope_id", value ?? "")}
										placeholder={t("routingRules.sheet.fields.selectVirtualKey")}
										noPortal
									/>
								)}
								{((scope === "team" && teamsData.teams.length === 0) ||
									(scope === "customer" && customersData.customers.length === 0) ||
									(scope === "virtual_key" && vksData.virtual_keys.length === 0)) && (
									<p className="text-muted-foreground text-sm">
										{t("routingRules.sheet.empty.noScopeEntities", {
											entity: t(`routingRules.scopeEntities.${scope}`, { defaultValue: scope }),
										})}
									</p>
								)}
								{errors.scope_id && <p className="text-destructive text-sm">{errors.scope_id.message}</p>}
							</div>
						)}

						<Separator />

						{/* CEL Rule Builder */}
						<div className="space-y-3">
							<Label>{t("routingRules.sheet.builder.title")}</Label>
							<p className="text-muted-foreground text-sm">{t("routingRules.sheet.builder.description")}</p>
							<CELRuleBuilder
								key={builderKey}
								initialQuery={query}
								onChange={handleQueryChange}
								providers={availableProviders}
								models={[]}
								allowCustomModels={true}
							/>
						</div>

						{/* Token、Request 和预算配置说明 */}
						<p className="text-muted-foreground text-xs">
							{t("routingRules.sheet.note.prefix")} <strong>{t("routingRules.sheet.note.providerPath")}</strong>{" "}
							{t("routingRules.sheet.note.middle")} <strong>{t("routingRules.sheet.note.modelPath")}</strong>{" "}
							{t("routingRules.sheet.note.suffix")}
						</p>

						<Separator />

						{/* 路由目标 */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div>
									<Label>{t("routingRules.sheet.targets.title")}</Label>
									<p className="text-muted-foreground mt-0.5 text-xs">{t("routingRules.sheet.targets.description")}</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addTarget}
									className="shrink-0 gap-2"
									data-testid="routing-rule-target-add"
								>
									<Plus className="h-4 w-4" />
									{t("routingRules.sheet.targets.add")}
								</Button>
							</div>

							<div className="space-y-3">
								{targets.map((target, index) => (
									<TargetRow
										key={index}
										target={target}
										index={index}
										providerOptions={providerOptions}
										allKeys={allKeysData}
										showRemove={targets.length > 1}
										onUpdate={updateTarget}
										onRemove={removeTarget}
									/>
								))}
							</div>

							{/* 权重合计提示 */}
							<div
								className={`flex items-center justify-end gap-2 text-xs font-medium ${Math.abs(totalWeight - 1) > 0.001 ? "text-destructive" : "text-muted-foreground"}`}
							>
								{t("routingRules.sheet.targets.totalWeight", { weight: totalWeight.toFixed(4) })}
								{Math.abs(totalWeight - 1) > 0.001 && (
									<span className="text-destructive">{t("routingRules.sheet.targets.mustEqualOne")}</span>
								)}
							</div>
						</div>

						{/* Fallbacks */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div>
									<Label>{t("routingRules.sheet.fallbacks.title")}</Label>{" "}
									<p className="text-muted-foreground mt-0.5 text-xs">{t("routingRules.sheet.fallbacks.description")}</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setValue("fallbacks", [...(fallbacks || []), ""])}
									className="gap-2"
								>
									<Plus className="h-4 w-4" />
									{t("routingRules.sheet.fallbacks.add")}
								</Button>
							</div>
							<div className="space-y-2">
								{(fallbacks || []).length === 0 ? (
									<p className="text-muted-foreground text-sm">{t("routingRules.sheet.fallbacks.noneConfigured")}</p>
								) : (
									(fallbacks || []).map((fallback, index) => {
										// 从 fallback 字符串解析 Provider/Model
										const parts = fallback.split("/");
										const fbProvider = parts[0] || "";
										const fbModel = parts[1] || "";

										const handleProviderChange = (newProvider: string) => {
											const model = fbModel || "";
											const newFallback = `${newProvider}/${model}`;
											const newFallbacks = [...fallbacks];
											newFallbacks[index] = newFallback;
											setValue("fallbacks", newFallbacks);
										};

										const handleModelChange = (newModel: string) => {
											const prov = fbProvider || "";
											const newFallback = `${prov}/${newModel}`;
											const newFallbacks = [...fallbacks];
											newFallbacks[index] = newFallback;
											setValue("fallbacks", newFallbacks);
										};

										const handleRemove = () => {
											const newFallbacks = fallbacks.filter((_: string, i: number) => i !== index);
											setValue("fallbacks", newFallbacks);
										};

										return (
											<div key={index} className="flex items-center gap-2">
												<div className="flex-1">
													<ComboboxSelect
														options={providerOptions}
														value={fbProvider || null}
														onValueChange={(value) => handleProviderChange(value ?? "")}
														placeholder={t("routingRules.sheet.fallbacks.selectProvider")}
														className="h-9"
														noPortal
													/>
												</div>
												<div className="flex-1">
													<ModelMultiselect
														provider={fbProvider || undefined}
														value={fbModel}
														onChange={handleModelChange}
														placeholder={t("routingRules.sheet.placeholders.incomingOptional")}
														isSingleSelect
														disabled={!fbProvider}
														className="!h-9 !min-h-9 w-full"
													/>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={handleRemove}
													className="h-9 px-2"
													aria-label={t("routingRules.sheet.fallbacks.removeAria", { index: index + 1 })}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										);
									})
								)}
							</div>
							<p className="text-muted-foreground text-xs">{t("routingRules.sheet.fallbacks.orderHint")}</p>
						</div>
					</div>
					{/* 操作按钮 */}
					<div className="bg-card sticky bottom-0 flex justify-end gap-3 border-t px-8 py-4">
						<Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
							{t("common.actions.cancel")}
						</Button>
						<Button type="submit" disabled={isLoading || !hasRequiredAccess}>
							{isEditing ? t("routingRules.sheet.actions.updateRule") : t("routingRules.sheet.actions.saveRule")}
						</Button>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}

interface TargetRowProps {
	target: RoutingTargetFormData;
	index: number;
	providerOptions: Array<{ label: string; value: string; icon: React.ReactNode }>;
	allKeys: Array<{ key_id: string; name: string; provider: string }>;
	showRemove: boolean;
	onUpdate: (index: number, field: keyof RoutingTargetFormData, value: string | number) => void;
	onRemove: (index: number) => void;
}

function TargetRow({ target, index, providerOptions, allKeys, showRemove, onUpdate, onRemove }: TargetRowProps) {
	const { t } = useTranslation();
	const availableKeys = target.provider
		? allKeys.filter((k) => k.provider === target.provider).map((k) => ({ id: k.key_id, name: k.name }))
		: [];

	return (
		<div className="space-y-3 rounded-lg border p-3" data-testid={`routing-target-${index}`}>
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground text-sm font-medium">
					{t("routingRules.sheet.targets.targetLabel", { index: index + 1 })}
				</span>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5">
						<Label htmlFor={`routing-target-${index}-weight-input`} className="text-muted-foreground shrink-0 text-xs">
							{t("routingRules.sheet.fields.weight")}
						</Label>
						<Input
							id={`routing-target-${index}-weight-input`}
							type="number"
							min={0.001}
							max={1}
							step={0.001}
							value={target.weight}
							onChange={(e) => onUpdate(index, "weight", parseFloat(e.target.value) || 0)}
							className="h-8 w-24 text-sm"
							data-testid={`routing-target-${index}-weight-input`}
						/>
					</div>
					{showRemove && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onRemove(index)}
							className="h-8 w-8 p-0"
							aria-label={t("routingRules.sheet.targets.removeAria", { index: index + 1 })}
							data-testid={`routing-target-${index}-remove-button`}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					)}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label id={`routing-target-${index}-provider-label`} className="text-xs">
						{t("routingRules.sheet.fields.provider")}
					</Label>
					<div className="flex gap-1.5">
						<ComboboxSelect
							options={providerOptions}
							value={target.provider || null}
							onValueChange={(value) => {
								onUpdate(index, "provider", value ?? "");
								onUpdate(index, "model", "");
								onUpdate(index, "key_id", "");
							}}
							placeholder={t("routingRules.sheet.placeholders.incomingOptional")}
							className="h-9 flex-1 text-sm"
							data-testid={`routing-target-${index}-provider-select`}
							noPortal
						/>
						{target.provider && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => {
									onUpdate(index, "provider", "");
									onUpdate(index, "model", "");
									onUpdate(index, "key_id", "");
								}}
								className="h-9 w-9 p-0"
								aria-label={t("routingRules.sheet.targets.clearProviderAria", { index: index + 1 })}
								data-testid={`routing-target-${index}-provider-clear`}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				</div>

				<div className="space-y-1.5">
					<Label id={`routing-target-${index}-model-label`} className="text-xs">
						{t("routingRules.sheet.fields.model")}
					</Label>
					<div className="flex gap-1.5">
						<div className="flex-1" data-testid={`routing-target-${index}-model-select`}>
							<ModelMultiselect
								provider={target.provider || undefined}
								value={target.model}
								onChange={(value) => onUpdate(index, "model", value)}
								placeholder={t("routingRules.sheet.placeholders.incomingOptional")}
								isSingleSelect
								loadModelsOnEmptyProvider
								className="!h-9 !min-h-9"
								inputId={`routing-target-${index}-model-input`}
								ariaLabelledBy={`routing-target-${index}-model-label`}
							/>
						</div>
						{target.model && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onUpdate(index, "model", "")}
								className="h-9 w-9 p-0"
								aria-label={t("routingRules.sheet.targets.clearModelAria", { index: index + 1 })}
								data-testid={`routing-target-${index}-model-clear`}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				</div>
			</div>

			{target.provider && (availableKeys.length > 0 || target.key_id) && (
				<div className="space-y-1.5">
					<Label id={`routing-target-${index}-apikey-label`} className="text-xs">
						{t("routingRules.sheet.fields.apiKey")}{" "}
						<span className="text-muted-foreground">{t("routingRules.sheet.fields.apiKeyHint")}</span>
					</Label>
					<div className="flex gap-1.5">
						<Select value={target.key_id || ""} onValueChange={(value) => onUpdate(index, "key_id", value)}>
							<SelectTrigger
								id={`routing-target-${index}-apikey-select`}
								aria-labelledby={`routing-target-${index}-apikey-label`}
								className="h-9 flex-1 text-sm"
								data-testid={`routing-target-${index}-apikey-select`}
							>
								<SelectValue placeholder={t("routingRules.sheet.fields.selectKeyOptional")} />
							</SelectTrigger>
							<SelectContent>
								{availableKeys.map((key) => (
									<SelectItem key={key.id} value={key.id}>
										{key.name}
									</SelectItem>
								))}
								{target.key_id && !availableKeys.some((k) => k.id === target.key_id) && (
									<SelectItem key={`pinned-${target.key_id}`} value={target.key_id}>
										{t("routingRules.sheet.fields.pinnedKey", { keyId: target.key_id })}
									</SelectItem>
								)}
							</SelectContent>
						</Select>
						{target.key_id && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onUpdate(index, "key_id", "")}
								className="h-9 w-9 p-0"
								aria-label={t("routingRules.sheet.targets.clearApiKeyAria", { index: index + 1 })}
								data-testid={`routing-target-${index}-apikey-clear`}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}