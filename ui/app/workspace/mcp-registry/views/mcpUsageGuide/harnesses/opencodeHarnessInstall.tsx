import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildOpenCodeConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps } from "../types";
import { getRegistrationLabel } from "../utils";

export function OpenCodeHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const configPath = {
		linux: "~/.config/opencode/opencode.json",
		macos: "~/.config/opencode/opencode.json",
		windows: "%APPDATA%/opencode/opencode.json",
	}[platform];

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildOpenCodeConfig({
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
			harnessName="OpenCode"
			label={t("mcpRegistry.usageGuide.command.configLabel")}
			logoSrc="/images/harness/opencode.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}