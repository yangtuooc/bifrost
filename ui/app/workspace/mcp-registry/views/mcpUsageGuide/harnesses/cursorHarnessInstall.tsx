import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildCursorConfig, buildCursorDeeplink } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { CursorConfigScope, HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function CursorHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const [configScope, setConfigScope] = useState<CursorConfigScope>("global");

	const serverArgs = useMemo(
		() => ({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey: virtualKey!,
		}),
		[clientConfig, selectedServers, serverScope, virtualKey],
	);

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildCursorConfig(serverArgs);
	}, [serverArgs, virtualKey]);

	const deeplink = useMemo(() => {
		if (!virtualKey) return "";
		return buildCursorDeeplink(serverArgs);
	}, [serverArgs, virtualKey]);

	const configPath = configScope === "project" ? ".cursor/mcp.json" : `${getUserHomePrefix(platform)}/.cursor/mcp.json`;

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={config}
			controls={
				<Select value={configScope} onValueChange={(value) => setConfigScope(value as CursorConfigScope)}>
					<SelectTrigger className="w-32" data-testid="mcp-usage-guide-cursor-config-scope" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="global">{t("mcpRegistry.usageGuide.scopes.global")}</SelectItem>
						<SelectItem value="project">{t("mcpRegistry.usageGuide.scopes.project")}</SelectItem>
					</SelectContent>
				</Select>
			}
			copySuccessMessage={t("mcpRegistry.usageGuide.command.configCopied")}
			deeplink={deeplink}
			emptyMessage={
				virtualKey
					? t("mcpRegistry.usageGuide.command.selectServersOrGateway")
					: t("mcpRegistry.usageGuide.command.selectVirtualKeyForConfig")
			}
			harnessName="Cursor"
			label={t("mcpRegistry.usageGuide.command.configLabel")}
			logoSrc="/images/harness/cursor.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}