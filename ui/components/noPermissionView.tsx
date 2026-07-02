import { cn } from "@/lib/utils";
import { ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NoPermissionViewProps {
	entity: string;
	className?: string;
	align?: "middle" | "top";
}

const ENTITY_TRANSLATION_KEYS = {
	"access-profiles": "accessProfiles",
	"adaptive routing": "adaptiveRouting",
	"audit logs": "auditLogs",
	"circuit breaker": "circuitBreaker",
	"cluster configuration": "clusterConfiguration",
	"complexity router": "complexityRouter",
	configuration: "configuration",
	"custom pricing": "customPricing",
	dashboard: "dashboard",
	governance: "governance",
	"guardrails configuration": "guardrailsConfiguration",
	logs: "logs",
	"MCP gateway configuration": "mcpGatewayConfiguration",
	"MCP gateway library": "mcpGatewayLibrary",
	"MCP gateway settings": "mcpGatewaySettings",
	"mcp logs": "mcpLogs",
	"MCP tool groups": "mcpToolGroups",
	"model catalog": "modelCatalog",
	"model providers": "modelProviders",
	"observability settings": "observabilitySettings",
	plugins: "plugins",
	"roles and permissions": "rolesAndPermissions",
	"routing rules": "routingRules",
	"skills repository": "skillsRepository",
	"user provisioning": "userProvisioning",
	"virtual keys": "virtualKeys",
} as const;

export function NoPermissionView({ entity, className, align = "middle" }: NoPermissionViewProps) {
	const { t } = useTranslation();
	const entityKey = ENTITY_TRANSLATION_KEYS[entity as keyof typeof ENTITY_TRANSLATION_KEYS];
	const entityLabel = entityKey ? t(`common.noPermission.entities.${entityKey}`) : entity;

	return (
		<div
			className={cn(
				"flex min-h-[calc(100vh-200px)] flex-col items-center  gap-4 text-center",
				align === "middle" ? "justify-center" : "justify-start",
				className,
			)}
		>
			<div className="text-muted-foreground">
				<ShieldX className="h-16 w-16" strokeWidth={1} />
			</div>
			<div className="flex flex-col items-center gap-1">
				<h1 className="text-muted-foreground text-xl font-medium">{t("common.noPermission.title", { entity: entityLabel })}</h1>
				<p className="text-muted-foreground mt-2 max-w-[400px] text-sm font-normal">{t("common.noPermission.description")}</p>
			</div>
		</div>
	);
}