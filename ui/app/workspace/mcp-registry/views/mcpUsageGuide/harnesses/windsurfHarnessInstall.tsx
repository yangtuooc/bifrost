import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildWindsurfConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function WindsurfHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const configPath = `${getUserHomePrefix(platform)}/.codeium/windsurf/mcp_config.json`;

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildWindsurfConfig({
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
			harnessName="Windsurf (Devin)"
			label={t("mcpRegistry.usageGuide.command.configLabel")}
			logoSrc="/images/harness/windsurf.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}