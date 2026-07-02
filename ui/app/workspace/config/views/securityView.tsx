import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecretVarInput } from "@/components/ui/secretVarInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IS_ENTERPRISE } from "@/lib/constants/config";
import { getErrorMessage, useGetCoreConfigQuery, useUpdateCoreConfigMutation } from "@/lib/store";
import { AuthConfig, CoreConfig, DefaultCoreConfig } from "@/lib/types/config";
import { SecretVar } from "@/lib/types/schemas";
import { parseArrayFromText } from "@/lib/utils/array";
import { validateOrigins } from "@/lib/utils/validation";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useGetAuthTypeQuery } from "@enterprise/lib/store/apis/scimApi";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const PASSWORD_REQUIREMENTS = [
	{ key: "minLength", test: (password: string) => password.length >= 12 },
	{ key: "uppercase", test: (password: string) => /[A-Z]/.test(password) },
	{ key: "lowercase", test: (password: string) => /[a-z]/.test(password) },
	{ key: "number", test: (password: string) => /\d/.test(password) },
	{ key: "special", test: (password: string) => /[^A-Za-z0-9]/.test(password) },
];

const getPasswordPolicyFailures = (password?: string) => {
	if (!password) return [];
	return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(password)).map((requirement) => requirement.key);
};

export default function SecurityView() {
	const { t } = useTranslation();
	const hasSettingsUpdateAccess = useRbac(RbacResource.Settings, RbacOperation.Update);
	const { data: bifrostConfig } = useGetCoreConfigQuery({ fromDB: true });
	const { data: authType, isLoading: authTypeLoading, error: authTypeError } = useGetAuthTypeQuery(undefined, { skip: !IS_ENTERPRISE });
	const config = bifrostConfig?.client_config;
	const [updateCoreConfig, { isLoading }] = useUpdateCoreConfigMutation();
	const [localConfig, setLocalConfig] = useState<CoreConfig>(DefaultCoreConfig);
	const showPasswordSection = !IS_ENTERPRISE || (!authTypeLoading && !authTypeError && authType?.type !== "sso");
	const passwordInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

	const [localValues, setLocalValues] = useState<{
		allowed_origins: string;
		allowed_headers: string;
		required_headers: string;
		whitelisted_routes: string;
	}>({
		allowed_origins: "",
		allowed_headers: "",
		required_headers: "",
		whitelisted_routes: "",
	});

	const [authConfig, setAuthConfig] = useState<AuthConfig>({
		admin_username: { value: "", ref: "" },
		admin_password: { value: "", ref: "" },
		is_enabled: false,
	});
	const [passwordError, setPasswordError] = useState("");

	useEffect(() => {
		if (bifrostConfig && config) {
			setLocalConfig(config);
			setLocalValues({
				allowed_origins: config?.allowed_origins?.join(", ") || "",
				allowed_headers: config?.allowed_headers?.join(", ") || "",
				required_headers: config?.required_headers?.join(", ") || "",
				whitelisted_routes: config?.whitelisted_routes?.join(", ") || "",
			});
		}
		if (bifrostConfig?.auth_config) {
			setAuthConfig(bifrostConfig.auth_config);
		}
	}, [config, bifrostConfig]);

	const hasChanges = useMemo(() => {
		if (!config) return false;
		const localOrigins = localConfig.allowed_origins?.slice().sort().join(",");
		const serverOrigins = config.allowed_origins?.slice().sort().join(",");
		const originsChanged = localOrigins !== serverOrigins;

		const localHeaders = localConfig.allowed_headers?.slice().sort().join(",");
		const serverHeaders = config.allowed_headers?.slice().sort().join(",");
		const headersChanged = localHeaders !== serverHeaders;

		const usernameChanged =
			authConfig.admin_username?.value !== bifrostConfig?.auth_config?.admin_username?.value ||
			authConfig.admin_username?.ref !== bifrostConfig?.auth_config?.admin_username?.ref ||
			authConfig.admin_username?.type !== bifrostConfig?.auth_config?.admin_username?.type;
		const passwordChanged =
			authConfig.admin_password?.value !== bifrostConfig?.auth_config?.admin_password?.value ||
			authConfig.admin_password?.ref !== bifrostConfig?.auth_config?.admin_password?.ref ||
			authConfig.admin_password?.type !== bifrostConfig?.auth_config?.admin_password?.type;
		const authChanged = showPasswordSection
			? authConfig.is_enabled !== bifrostConfig?.auth_config?.is_enabled || usernameChanged || passwordChanged
			: false;

		const localRequired = localConfig.required_headers?.slice().sort().join(",");
		const serverRequired = config.required_headers?.slice().sort().join(",");
		const requiredChanged = localRequired !== serverRequired;

		const localWhitelistedRoutes = localConfig.whitelisted_routes?.slice().sort().join(",");
		const serverWhitelistedRoutes = config.whitelisted_routes?.slice().sort().join(",");
		const whitelistedRoutesChanged = localWhitelistedRoutes !== serverWhitelistedRoutes;

		const enforceAuthOnInferenceChanged = localConfig.enforce_auth_on_inference !== config.enforce_auth_on_inference;
		const allowDirectKeysChanged = localConfig.allow_direct_keys !== config.allow_direct_keys;

		return (
			originsChanged ||
			headersChanged ||
			requiredChanged ||
			whitelistedRoutesChanged ||
			authChanged ||
			enforceAuthOnInferenceChanged ||
			allowDirectKeysChanged
		);
	}, [config, localConfig, authConfig, bifrostConfig, showPasswordSection]);

	const needsRestart = useMemo(() => {
		if (!config) return false;

		const localOrigins = localConfig.allowed_origins?.slice().sort().join(",");
		const serverOrigins = config.allowed_origins?.slice().sort().join(",");
		const originsChanged = localOrigins !== serverOrigins;

		const localHeaders = localConfig.allowed_headers?.slice().sort().join(",");
		const serverHeaders = config.allowed_headers?.slice().sort().join(",");
		const headersChanged = localHeaders !== serverHeaders;

		const enforceAuthOnInferenceChanged = localConfig.enforce_auth_on_inference !== config.enforce_auth_on_inference && IS_ENTERPRISE;

		return originsChanged || headersChanged || enforceAuthOnInferenceChanged;
	}, [config, localConfig]);

	const handleAllowedOriginsChange = useCallback((value: string) => {
		setLocalValues((prev) => ({ ...prev, allowed_origins: value }));
		setLocalConfig((prev) => ({ ...prev, allowed_origins: parseArrayFromText(value) }));
	}, []);

	const handleAllowedHeadersChange = useCallback((value: string) => {
		setLocalValues((prev) => ({ ...prev, allowed_headers: value }));
		setLocalConfig((prev) => ({ ...prev, allowed_headers: parseArrayFromText(value) }));
	}, []);

	const handleRequiredHeadersChange = useCallback((value: string) => {
		setLocalValues((prev) => ({ ...prev, required_headers: value }));
		setLocalConfig((prev) => ({ ...prev, required_headers: parseArrayFromText(value) }));
	}, []);

	const handleWhitelistedRoutesChange = useCallback((value: string) => {
		setLocalValues((prev) => ({ ...prev, whitelisted_routes: value }));
		setLocalConfig((prev) => ({ ...prev, whitelisted_routes: parseArrayFromText(value) }));
	}, []);

	const handleConfigChange = useCallback((field: keyof CoreConfig, value: boolean) => {
		setLocalConfig((prev) => ({ ...prev, [field]: value }));
	}, []);

	const handleAuthToggle = useCallback((checked: boolean) => {
		setAuthConfig((prev) => ({ ...prev, is_enabled: checked }));
	}, []);

	const handleAuthFieldChange = useCallback(
		(field: "admin_username" | "admin_password", value: SecretVar) => {
			if (field === "admin_password") {
				const passwordPolicyFailures = !value.ref && value.value ? getPasswordPolicyFailures(value.value) : [];
				setPasswordError(
					passwordPolicyFailures.length > 0
						? t("config.security.validation.passwordMustInclude", {
								requirements: passwordPolicyFailures.map((key) => t(`config.security.passwordRequirements.${key}`)).join(", "),
							})
						: "",
				);
			}
			setAuthConfig((prev) => ({ ...prev, [field]: value }));
		},
		[t],
	);

	const handleSave = useCallback(async () => {
		try {
			const validation = validateOrigins(localConfig.allowed_origins);

			if (!validation.isValid && localConfig.allowed_origins.length > 0) {
				toast.error(t("config.security.validation.invalidOrigins", { origins: validation.invalidOrigins.join(", ") }));
				return;
			}
			const hasUsername = authConfig.admin_username?.value || authConfig.admin_username?.ref;
			const hasPassword = authConfig.admin_password?.value || authConfig.admin_password?.ref;
			const passwordPolicyFailures =
				showPasswordSection && authConfig.is_enabled && !authConfig.admin_password?.ref && authConfig.admin_password?.value
					? getPasswordPolicyFailures(authConfig.admin_password.value)
					: [];

			if (passwordPolicyFailures.length > 0) {
				setPasswordError(
					t("config.security.validation.passwordMustInclude", {
						requirements: passwordPolicyFailures.map((key) => t(`config.security.passwordRequirements.${key}`)).join(", "),
					}),
				);
				passwordInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
				passwordInputRef.current?.focus({ preventScroll: true });
				return;
			}
			setPasswordError("");

			await updateCoreConfig({
				...bifrostConfig!,
				client_config: localConfig,
				...(showPasswordSection
					? {
							auth_config: authConfig.is_enabled && hasUsername && hasPassword ? authConfig : { ...authConfig, is_enabled: false },
						}
					: {}),
			}).unwrap();
			toast.success(t("config.security.toasts.updated"));
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	}, [bifrostConfig, localConfig, authConfig, showPasswordSection, updateCoreConfig, t]);

	return (
		<div className="mx-auto h-[calc(100vh-50px)] w-full max-w-4xl space-y-4 overflow-y-auto">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">{t("config.security.title")}</h2>
				<p className="text-muted-foreground text-sm">{t("config.security.description")}</p>
			</div>

			<div className="space-y-4">
				{/* Password Protect the Dashboard */}
				{IS_ENTERPRISE && authTypeLoading ? (
					<div className="flex items-center justify-center rounded-sm border p-8" data-testid="security-auth-type-loading">
						<Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden />
						<span className="sr-only">{t("config.security.auth.loading")}</span>
					</div>
				) : null}
				{IS_ENTERPRISE && !authTypeLoading && authTypeError ? (
					<Alert variant="destructive" data-testid="security-auth-type-error">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>
							{t("config.security.auth.loadFailed")} {getErrorMessage(authTypeError)}
						</AlertDescription>
					</Alert>
				) : null}
				{showPasswordSection && (
					<div>
						<div className="space-y-4 rounded-sm border p-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="auth-enabled" className="text-sm font-medium">
										{t("config.security.auth.passwordProtectDashboard")} <Badge variant="secondary">{t("common.status.beta")}</Badge>
									</Label>
									<p className="text-muted-foreground text-sm">{t("config.security.auth.passwordProtectDescription")}</p>
								</div>
								<Switch id="auth-enabled" checked={authConfig.is_enabled} onCheckedChange={handleAuthToggle} />
							</div>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="admin-username">{t("config.security.auth.username")}</Label>
									<SecretVarInput
										id="admin-username"
										type="text"
										placeholder={t("config.security.auth.usernamePlaceholder")}
										value={authConfig.admin_username}
										disabled={!authConfig.is_enabled}
										onChange={(value) => handleAuthFieldChange("admin_username", value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="admin-password">{t("config.security.auth.password")}</Label>
									<SecretVarInput
										ref={passwordInputRef}
										id="admin-password"
										aria-invalid={!!passwordError}
										aria-describedby={passwordError ? "admin-password-error" : undefined}
										type="password"
										placeholder={t("config.security.auth.passwordPlaceholder")}
										value={authConfig.admin_password}
										disabled={!authConfig.is_enabled}
										onChange={(value) => handleAuthFieldChange("admin_password", value)}
									/>
									<p className="text-muted-foreground text-xs">{t("config.security.auth.passwordHint")}</p>
									{passwordError ? (
										<p id="admin-password-error" className="text-destructive text-xs" role="alert">
											{passwordError}
										</p>
									) : null}
								</div>
							</div>
						</div>
					</div>
				)}
				{/* Enable Auth on Inference */}
				<div className="flex items-center justify-between space-x-2 rounded-sm border p-4">
					<div className="space-y-0.5">
						<label htmlFor="enforce-auth-on-inference" className="text-sm font-medium">
							{IS_ENTERPRISE ? t("config.security.inference.enterpriseTitle") : t("config.security.inference.openSourceTitle")}
						</label>
						<p className="text-muted-foreground text-sm">
							{IS_ENTERPRISE ? t("config.security.inference.enterpriseDescription") : t("config.security.inference.openSourceDescription")}{" "}
							{t("config.security.inference.see")}{" "}
							<a
								href="https://docs.getbifrost.ai/features/governance/virtual-keys"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline"
								data-testid="security-virtual-keys-docs-link"
							>
								{t("config.security.inference.documentation")}
							</a>{" "}
							{t("config.security.inference.forDetails")}
						</p>
					</div>
					<Switch
						id="enforce-auth-on-inference"
						data-testid="enforce-auth-on-inference-switch"
						checked={localConfig.enforce_auth_on_inference}
						onCheckedChange={(checked) => handleConfigChange("enforce_auth_on_inference", checked)}
					/>
				</div>
				{/* Allow Direct API Keys */}
				<div className="flex items-center justify-between space-x-2 rounded-sm border p-4">
					<div className="space-y-0.5">
						<label htmlFor="allow-direct-keys" className="text-sm font-medium">
							{t("config.security.directKeys.title")}
						</label>
						<p className="text-muted-foreground text-sm">
							{t("config.security.directKeys.descriptionStart")} <b>Authorization</b>, <b>x-api-key</b>, {t("common.filters.or")}{" "}
							<b>x-goog-api-key</b> {t("config.security.directKeys.descriptionMiddle")} <b>x-bf-direct-key: true</b>.{" "}
							{t("config.security.directKeys.descriptionEnd")}
						</p>
					</div>
					<Switch
						id="allow-direct-keys"
						data-testid="security-allow-direct-keys-switch"
						checked={localConfig.allow_direct_keys}
						onCheckedChange={(checked) => handleConfigChange("allow_direct_keys", checked)}
					/>
				</div>
				{/* Allowed Origins */}
				{needsRestart && <RestartWarning />}
				<div>
					<div className="space-y-2 rounded-sm border p-4">
						<div className="space-y-0.5">
							<label htmlFor="allowed-origins" className="text-sm font-medium">
								{t("config.security.allowedOrigins.title")}
							</label>
							<p className="text-muted-foreground text-sm">{t("config.security.allowedOrigins.description")}</p>
						</div>
						<Textarea
							id="allowed-origins"
							className="h-24"
							placeholder={t("config.security.allowedOrigins.placeholder")}
							value={localValues.allowed_origins}
							onChange={(e) => handleAllowedOriginsChange(e.target.value)}
						/>
					</div>
				</div>
				{/* Allowed Headers */}
				<div>
					<div className="space-y-2 rounded-sm border p-4">
						<div className="space-y-0.5">
							<label htmlFor="allowed-headers" className="text-sm font-medium">
								{t("config.security.allowedHeaders.title")}
							</label>
							<p className="text-muted-foreground text-sm">{t("config.security.allowedHeaders.description")}</p>
						</div>
						<Textarea
							id="allowed-headers"
							className="h-24"
							placeholder={t("config.security.allowedHeaders.placeholder")}
							value={localValues.allowed_headers}
							onChange={(e) => handleAllowedHeadersChange(e.target.value)}
						/>
					</div>
				</div>
				{/* Required Headers */}
				<div>
					<div className="space-y-2 rounded-sm border p-4">
						<div className="space-y-0.5">
							<label htmlFor="required-headers" className="text-sm font-medium">
								{t("config.security.requiredHeaders.title")}
							</label>
							<p className="text-muted-foreground text-sm">{t("config.security.requiredHeaders.description")}</p>
						</div>
						<Textarea
							id="required-headers"
							data-testid="required-headers-textarea"
							className="h-24"
							placeholder={t("config.security.requiredHeaders.placeholder")}
							value={localValues.required_headers}
							onChange={(e) => handleRequiredHeadersChange(e.target.value)}
						/>
					</div>
				</div>
				{/* Whitelisted Routes */}
				<div>
					<div className="space-y-2 rounded-sm border p-4">
						<div className="space-y-0.5">
							<label htmlFor="whitelisted-routes" className="text-sm font-medium">
								{t("config.security.whitelistedRoutes.title")}
							</label>
							<p className="text-muted-foreground text-sm">
								{t("config.security.whitelistedRoutes.descriptionStart")} <b>/health</b>, <b>/api/session/login</b>,{" "}
								{t("common.filters.or")} <b>/api/session/is-auth-enabled</b> {t("config.security.whitelistedRoutes.descriptionEnd")}
							</p>
						</div>
						<Textarea
							id="whitelisted-routes"
							data-testid="whitelisted-routes-textarea"
							className="h-24"
							placeholder={t("config.security.whitelistedRoutes.placeholder")}
							value={localValues.whitelisted_routes}
							onChange={(e) => handleWhitelistedRoutesChange(e.target.value)}
						/>
					</div>
				</div>
			</div>
			<div className="bg-card sticky bottom-0 flex justify-end pt-2">
				<Button onClick={handleSave} disabled={!hasChanges || isLoading || !hasSettingsUpdateAccess}>
					{isLoading ? t("common.actions.saving") : t("common.actions.saveChanges")}
				</Button>
			</div>
		</div>
	);
}

const RestartWarning = () => {
	const { t } = useTranslation();
	return (
		<Alert variant="destructive" className="mt-2">
			<AlertTriangle className="h-4 w-4" />
			<AlertDescription>{t("config.security.restartWarning")}</AlertDescription>
		</Alert>
	);
};