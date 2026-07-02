import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildClaudeCodeCommand } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { ClaudeScope, HarnessInstallProps } from "../types";
import { getRegistrationLabel } from "../utils";

export function ClaudeCodeHarnessInstall({
	canGenerateCommand,
	clientConfig,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation();
	const [scope, setScope] = useState<ClaudeScope>("local");

	const command = useMemo(() => {
		if (!virtualKey) return "";
		return buildClaudeCodeCommand({
			clientConfig,
			scope,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, scope, selectedServers, serverScope, virtualKey]);

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={command}
			controls={
				<Select value={scope} onValueChange={(value) => setScope(value as ClaudeScope)}>
					<SelectTrigger className="w-32" data-testid="mcp-usage-guide-claude-scope" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="local">{t("mcpRegistry.usageGuide.scopes.local")}</SelectItem>
						<SelectItem value="project">{t("mcpRegistry.usageGuide.scopes.project")}</SelectItem>
						<SelectItem value="user">{t("mcpRegistry.usageGuide.scopes.user")}</SelectItem>
					</SelectContent>
				</Select>
			}
			emptyMessage={
				virtualKey
					? t("mcpRegistry.usageGuide.command.selectServersOrGateway")
					: t("mcpRegistry.usageGuide.command.selectVirtualKeyForCommand")
			}
			harnessName="Claude Code"
			logoSrc="/images/harness/claudecode.svg"
			registrationLabel={getRegistrationLabel(serverScope, selectedServers, t)}
		/>
	);
}