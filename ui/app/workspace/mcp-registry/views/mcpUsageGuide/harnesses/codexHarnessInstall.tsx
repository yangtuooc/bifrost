import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildCodexConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { CodexConfigScope, HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function CodexHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const [configScope, setConfigScope] = useState<CodexConfigScope>("user");

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildCodexConfig({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, selectedServers, serverScope, virtualKey]);

	const configPath = configScope === "project" ? ".codex/config.toml" : `${getUserHomePrefix(platform)}/.codex/config.toml`;

	return (
		<div className="flex flex-col gap-3">
			<HarnessCommandSection
				canCopyCommand={canGenerateCommand}
				command={config}
				controls={
					<Select value={configScope} onValueChange={(value) => setConfigScope(value as CodexConfigScope)}>
						<SelectTrigger className="w-32" data-testid="mcp-usage-guide-codex-config-scope" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="user">{t("mcpRegistry.usageGuide.scopes.user")}</SelectItem>
							<SelectItem value="project">{t("mcpRegistry.usageGuide.scopes.project")}</SelectItem>
						</SelectContent>
					</Select>
				}
				copySuccessMessage={t("mcpRegistry.usageGuide.command.configCopied")}
				emptyMessage={
					virtualKey
						? t("mcpRegistry.usageGuide.command.selectServersOrGateway")
						: t("mcpRegistry.usageGuide.command.selectVirtualKeyForConfig")
				}
				harnessName="Codex"
				label="config.toml"
				logoSrc="/images/harness/codex.svg"
				registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
			/>
		</div>
	);
}