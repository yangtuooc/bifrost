import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Boxes, Server } from "lucide-react";
import { useTranslation } from "react-i18next";

const MCP_SERVERS_DOCS_URL = "https://docs.getbifrost.ai/features/mcp/overview";

interface MCPServersEmptyStateProps {
	onAddClick: () => void;
	canCreate?: boolean;
}

export function MCPServersEmptyState({ onAddClick, canCreate = true }: MCPServersEmptyStateProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-[80vh] w-full flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="text-muted-foreground">
				<Server className="h-[5.5rem] w-[5.5rem]" strokeWidth={1} />
			</div>
			<div className="flex flex-col gap-1">
				<h1 className="text-muted-foreground text-xl font-medium">{t("mcpRegistry.empty.title")}</h1>
				<div className="text-muted-foreground mx-auto mt-2 max-w-[600px] text-sm font-normal">{t("mcpRegistry.empty.description")}</div>
				<div className="mx-auto mt-6 flex flex-row flex-wrap items-center justify-center gap-2">
					<Button
						variant="outline"
						aria-label={t("mcpRegistry.empty.readMoreAria")}
						data-testid="mcp-registry-button-read-more"
						onClick={() => {
							window.open(`${MCP_SERVERS_DOCS_URL}?utm_source=bfd`, "_blank", "noopener,noreferrer");
						}}
					>
						{t("common.actions.readMore")} <ArrowUpRight className="text-muted-foreground h-3 w-3" />
					</Button>
					<Button
						aria-label={t("mcpRegistry.empty.addAria")}
						onClick={onAddClick}
						disabled={!canCreate}
						data-testid="create-mcp-client-btn"
					>
						{t("mcpRegistry.empty.addServer")}
					</Button>
					<Button asChild aria-label={t("mcpRegistry.empty.browseLibraryAria")} data-testid="mcp-library-empty-link-btn">
						<Link to="/workspace/mcp-registry/library">
							<Boxes className="h-4 w-4" />
							{t("mcpRegistry.empty.browseLibrary")}
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}