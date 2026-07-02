import { cn } from "@/lib/utils";
import { Orbit } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildAntigravityConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function AntigravityIcon({ className }: { className?: string }) {
	return <Orbit className={cn("text-muted-foreground", className)} />;
}

export function AntigravityHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const configPath = `${getUserHomePrefix(platform)}/.gemini/antigravity/mcp_config.json`;

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildAntigravityConfig({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, selectedServers, serverScope, virtualKey]);

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={config}
			controls={null}
			copySuccessMessage={t("mcpRegistry.usageGuide.command.configCopied")}
			emptyMessage={
				virtualKey
					? t("mcpRegistry.usageGuide.command.selectServersOrGateway")
					: t("mcpRegistry.usageGuide.command.selectVirtualKeyForConfig")
			}
			harnessName="Antigravity"
			label={t("mcpRegistry.usageGuide.command.configLabel")}
			logoSrc="/images/harness/antigravity.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}