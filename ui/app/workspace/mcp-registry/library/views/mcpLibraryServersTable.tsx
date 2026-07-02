import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage, useDeleteMCPLibraryEntryMutation } from "@/lib/store";
import type { MCPLibraryEntry } from "@/lib/types/mcp";
import { Link } from "@tanstack/react-router";
import { BookIcon, Check, Download, LogIn, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MCPLibraryDeleteDialog } from "./mcpLibraryDeleteDialog";
import { localizedAuthLabel, MCP_ICON_FALLBACK, transportIcon, transportLabel } from "./mcpLibraryServerCard";

interface MCPLibraryServersTableProps {
	servers: MCPLibraryEntry[];
	installedServerSlugs: Set<string>;
	canCreateMCPClient: boolean;
	canDelete: boolean;
	onInstall: (server: MCPLibraryEntry) => void;
}

export function MCPLibraryServersTable({
	servers,
	installedServerSlugs,
	canCreateMCPClient,
	canDelete,
	onInstall,
}: MCPLibraryServersTableProps) {
	const { t } = useTranslation();
	const [deleteEntry, { isLoading: isDeleting }] = useDeleteMCPLibraryEntryMutation();
	const [serverToDelete, setServerToDelete] = useState<MCPLibraryEntry | null>(null);

	const handleDelete = async () => {
		if (!serverToDelete) return;
		try {
			await deleteEntry(serverToDelete.id).unwrap();
			toast.success(t("mcpRegistry.library.toasts.removed", { name: serverToDelete.name }));
			setServerToDelete(null);
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};

	return (
		<div className="mb-2 overflow-y-auto rounded-md border" data-testid="mcp-library-table-view">
			<Table containerClassName="overflow-x-clip">
				<TableHeader className="bg-muted sticky top-0 z-10">
					<TableRow>
						<TableHead className="w-16">{t("mcpRegistry.library.table.icon")}</TableHead>
						<TableHead>{t("mcpRegistry.library.table.server")}</TableHead>
						<TableHead className="hidden w-10 lg:table-cell">{t("mcpRegistry.library.table.details")}</TableHead>
						<TableHead className="w-32 text-right">{t("common.table.actions")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{servers.map((server) => {
						const isInstalled = installedServerSlugs.has(server.slug);
						return (
							<TableRow key={server.slug} className="group" data-testid={`mcp-library-table-row-${server.slug}`}>
								<TableCell>
									<div className="bg-background flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border shadow-xs">
										{server.icon_url ? (
											<img
												src={server.icon_url}
												alt=""
												className="h-full w-full object-contain p-1.5"
												onError={(event) => {
													event.currentTarget.onerror = null;
													event.currentTarget.src = MCP_ICON_FALLBACK;
												}}
											/>
										) : (
											<img src={"/images/mcp.svg"} alt="" className="h-full w-full object-contain p-1.5" />
										)}
									</div>
								</TableCell>
								<TableCell className="min-w-72 whitespace-normal">
									<div className="min-w-0 space-y-1">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<span className="font-medium">{server.name}</span>
											{isInstalled && (
												<Badge variant="success" className="gap-1">
													<Check className="size-3" />
													{t("mcpRegistry.library.badges.installed")}
												</Badge>
											)}
											{server.source === "custom" && <Badge variant="outline">{t("mcpRegistry.library.badges.custom")}</Badge>}
										</div>
										<p className="text-muted-foreground line-clamp-1 max-w-4xl text-sm leading-5">
											{server.description || t("mcpRegistry.library.empty.noDescription")}
										</p>
									</div>
								</TableCell>
								<TableCell className="text-muted-foreground hidden text-xs whitespace-normal lg:table-cell">
									<div className="flex min-w-0 items-center gap-2">
										<span className="flex shrink-0 items-center gap-1">
											{transportIcon(server.connection_type)}
											{transportLabel(server.connection_type)}
										</span>
										<span className="bg-border h-3 w-px shrink-0" />
										<span className="truncate">{localizedAuthLabel(server.auth_type, t)}</span>
									</div>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										{canDelete && (
											<div className="opacity-0 group-hover:opacity-100">
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="outline"
															size="icon"
															onClick={() => setServerToDelete(server)}
															aria-label={t("mcpRegistry.library.aria.remove", { name: server.name })}
															data-testid={`mcp-library-table-delete-${server.slug}`}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>{t("mcpRegistry.library.tooltips.remove")}</TooltipContent>
												</Tooltip>
											</div>
										)}
										{server.docs_url && (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														asChild
														variant="outline"
														size="icon"
														aria-label={t("mcpRegistry.library.aria.openDocs", { name: server.name })}
														data-testid={`mcp-library-table-docs-${server.slug}`}
													>
														<a href={server.docs_url} target="_blank" rel="noreferrer">
															<BookIcon className="h-4 w-4" />
														</a>
													</Button>
												</TooltipTrigger>
												<TooltipContent>{t("mcpRegistry.library.tooltips.documentation")}</TooltipContent>
											</Tooltip>
										)}
										{isInstalled ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button asChild size="icon" data-testid={`mcp-library-table-open-${server.slug}`}>
														<Link to="/workspace/mcp-registry" aria-label={t("mcpRegistry.library.aria.open", { name: server.name })}>
															<LogIn className="h-4 w-4" />
														</Link>
													</Button>
												</TooltipTrigger>
												<TooltipContent>{t("mcpRegistry.library.tooltips.openInstalled")}</TooltipContent>
											</Tooltip>
										) : (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														size="icon"
														onClick={() => onInstall(server)}
														disabled={!canCreateMCPClient}
														aria-label={t("mcpRegistry.library.aria.install", { name: server.name })}
														data-testid={`mcp-library-table-install-${server.slug}`}
													>
														<Download className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>{t("mcpRegistry.library.actions.install")}</TooltipContent>
											</Tooltip>
										)}
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			<MCPLibraryDeleteDialog
				server={serverToDelete}
				open={!!serverToDelete}
				isDeleting={isDeleting}
				onOpenChange={(open) => !open && setServerToDelete(null)}
				onConfirm={handleDelete}
				confirmTestId="mcp-library-table-delete-confirm"
			/>
		</div>
	);
}

/** Library catalog 加载时展示的表格骨架屏。 */
export function MCPLibraryServersTableSkeleton({ rows = 8 }: { rows?: number }) {
	const { t } = useTranslation();
	return (
		<div className="mb-2 overflow-y-auto rounded-md border" data-testid="mcp-library-table-skeleton">
			<Table containerClassName="overflow-x-clip">
				<TableHeader className="bg-muted sticky top-0 z-10">
					<TableRow>
						<TableHead className="w-16">{t("mcpRegistry.library.table.icon")}</TableHead>
						<TableHead>{t("mcpRegistry.library.table.server")}</TableHead>
						<TableHead className="hidden w-10 lg:table-cell">{t("mcpRegistry.library.table.details")}</TableHead>
						<TableHead className="w-32 text-right">{t("common.table.actions")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: rows }).map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders have no stable id
						<TableRow key={index}>
							<TableCell>
								<Skeleton className="h-10 w-10 rounded-md" />
							</TableCell>
							<TableCell className="min-w-72 whitespace-normal">
								<div className="space-y-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-64" />
								</div>
							</TableCell>
							<TableCell className="hidden lg:table-cell">
								<Skeleton className="h-3 w-28" />
							</TableCell>
							<TableCell className="text-right">
								<div className="flex justify-end gap-2">
									<Skeleton className="h-9 w-9 rounded-md" />
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}