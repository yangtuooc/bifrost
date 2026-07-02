import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage, useCreateMCPLibraryEntryMutation } from "@/lib/store";
import type { CreateMCPLibraryEntryRequest, MCPAuthType, MCPConnectionType } from "@/lib/types/mcp";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface MCPLibraryAddServerFormData {
	name: string;
	description: string;
	category: string;
	connection_type: MCPConnectionType;
	connection_url: string;
	command: string;
	args: string;
	envs: string;
	auth_type: MCPAuthType;
	required_header_keys: string;
	icon_url: string;
	docs_url: string;
	tags: string;
}

interface MCPLibraryAddServerSheetProps {
	open: boolean;
	onClose: () => void;
}

const DEFAULTS: MCPLibraryAddServerFormData = {
	name: "",
	description: "",
	category: "",
	connection_type: "http",
	connection_url: "",
	command: "",
	args: "",
	envs: "",
	auth_type: "none",
	required_header_keys: "",
	icon_url: "",
	docs_url: "",
	tags: "",
};

// Split a comma/newline-separated string into a trimmed, non-empty list.
function parseList(text: string): string[] {
	return text
		.split(/[\n,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function MCPLibraryAddServerSheet({ open, onClose }: MCPLibraryAddServerSheetProps) {
	const { t } = useTranslation();
	const [createEntry, { isLoading }] = useCreateMCPLibraryEntryMutation();

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors },
	} = useForm<MCPLibraryAddServerFormData>({ defaultValues: DEFAULTS });

	useEffect(() => {
		if (open) reset(DEFAULTS);
	}, [open, reset]);

	const connectionType = watch("connection_type");
	const authType = watch("auth_type");
	const isStdio = connectionType === "stdio";
	const needsHeaderKeys = authType === "headers" || authType === "per_user_headers";

	const onSubmit = async (data: MCPLibraryAddServerFormData) => {
		const tags = parseList(data.tags);
		const payload: CreateMCPLibraryEntryRequest = {
			name: data.name.trim(),
			description: data.description.trim() || undefined,
			category: data.category.trim() || undefined,
			connection_type: data.connection_type,
			auth_type: data.auth_type,
			icon_url: data.icon_url.trim() || undefined,
			docs_url: data.docs_url.trim() || undefined,
			tags: tags.length ? tags : undefined,
		};

		if (isStdio) {
			payload.stdio_config = {
				command: data.command.trim(),
				args: parseList(data.args),
				envs: parseList(data.envs),
			};
		} else {
			payload.connection_url = data.connection_url.trim();
		}

		if (needsHeaderKeys) {
			payload.required_header_keys = parseList(data.required_header_keys);
		}

		try {
			await createEntry(payload).unwrap();
			toast.success(t("mcpRegistry.libraryAdd.toasts.published"));
			onClose();
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};

	return (
		<Sheet open={open} onOpenChange={(sheetOpen) => !sheetOpen && onClose()}>
			<SheetContent className="flex w-full flex-col overflow-x-hidden p-0 pt-4">
				<SheetHeader className="flex flex-col items-start px-0 py-4" headerClassName="mb-0 sticky px-8 -top-4 bg-card z-10">
					<SheetTitle>{t("mcpRegistry.libraryAdd.title")}</SheetTitle>
					<SheetDescription>{t("mcpRegistry.libraryAdd.description")}</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
					<div className="flex-1 space-y-4 px-8 py-4">
						{/* Name */}
						<div className="space-y-2">
							<Label htmlFor="mcp-add-name">{t("mcpRegistry.libraryAdd.fields.name")}</Label>
							<Input
								id="mcp-add-name"
								placeholder={t("mcpRegistry.libraryAdd.placeholders.name")}
								data-testid="mcp-add-name-input"
								className={errors.name ? "border-destructive" : ""}
								{...register("name", {
									required: t("mcpRegistry.libraryAdd.errors.nameRequired"),
									validate: (v) => v.trim().length > 0 || t("mcpRegistry.libraryAdd.errors.nameRequired"),
								})}
							/>
							{errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
						</div>

						{/* Description */}
						<div className="space-y-2">
							<Label htmlFor="mcp-add-description">{t("mcpRegistry.libraryAdd.fields.description")}</Label>
							<Textarea
								id="mcp-add-description"
								placeholder={t("mcpRegistry.libraryAdd.placeholders.description")}
								data-testid="mcp-add-description-input"
								{...register("description")}
							/>
						</div>

						{/* Connection details */}
						<div className="flex gap-3">
							<div className="w-32 shrink-0 space-y-2">
								<Label>{t("mcpRegistry.libraryAdd.fields.connectionType")}</Label>
								<Select value={connectionType} onValueChange={(v) => setValue("connection_type", v as MCPConnectionType)}>
									<SelectTrigger className="w-full" data-testid="mcp-add-connection-type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="http">{t("mcpRegistry.libraryAdd.connectionTypes.http")}</SelectItem>
										<SelectItem value="sse">{t("mcpRegistry.libraryAdd.connectionTypes.sse")}</SelectItem>
										<SelectItem value="stdio">{t("mcpRegistry.libraryAdd.connectionTypes.stdio")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{!isStdio && (
								<div className="min-w-0 flex-1 space-y-2">
									<Label htmlFor="mcp-add-url">{t("mcpRegistry.libraryAdd.fields.connectionUrl")}</Label>
									<Input
										id="mcp-add-url"
										placeholder="https://my-server.internal/mcp"
										data-testid="mcp-add-url-input"
										className={errors.connection_url ? "border-destructive" : ""}
										{...register("connection_url", {
											validate: (v) => (!isStdio ? v.trim().length > 0 || t("mcpRegistry.libraryAdd.errors.connectionUrlRequired") : true),
										})}
									/>
									{errors.connection_url && <p className="text-destructive text-sm">{errors.connection_url.message}</p>}
								</div>
							)}
						</div>

						{isStdio && (
							<div className="space-y-4 rounded-sm border p-4">
								<div className="space-y-2">
									<Label htmlFor="mcp-add-command">{t("mcpRegistry.libraryAdd.fields.command")}</Label>
									<Input
										id="mcp-add-command"
										placeholder="npx"
										data-testid="mcp-add-command-input"
										className={errors.command ? "border-destructive" : ""}
										{...register("command", {
											validate: (v) => (isStdio ? v.trim().length > 0 || t("mcpRegistry.libraryAdd.errors.commandRequired") : true),
										})}
									/>
									{errors.command && <p className="text-destructive text-sm">{errors.command.message}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="mcp-add-args">{t("mcpRegistry.libraryAdd.fields.arguments")}</Label>
									<Input
										id="mcp-add-args"
										placeholder={t("mcpRegistry.libraryAdd.placeholders.arguments")}
										data-testid="mcp-add-args-input"
										{...register("args")}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="mcp-add-envs">{t("mcpRegistry.libraryAdd.fields.envs")}</Label>
									<Input
										id="mcp-add-envs"
										placeholder={t("mcpRegistry.libraryAdd.placeholders.envs")}
										data-testid="mcp-add-envs-input"
										{...register("envs")}
									/>
									<p className="text-muted-foreground text-xs">{t("mcpRegistry.libraryAdd.help.onlyNamesAtInstall")}</p>
								</div>
							</div>
						)}

						{/* Auth + category */}
						<div className="grid grid-cols-2 gap-3">
							<div className="w-full space-y-2">
								<Label>{t("mcpRegistry.libraryAdd.fields.authentication")}</Label>
								<Select value={authType} onValueChange={(v) => setValue("auth_type", v as MCPAuthType)}>
									<SelectTrigger data-testid="mcp-add-auth-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("mcpRegistry.libraryAdd.auth.none")}</SelectItem>
										<SelectItem value="headers">{t("mcpRegistry.libraryAdd.auth.headers")}</SelectItem>
										<SelectItem value="oauth">{t("mcpRegistry.libraryAdd.auth.oauth")}</SelectItem>
										<SelectItem value="per_user_headers">{t("mcpRegistry.libraryAdd.auth.perUserHeaders")}</SelectItem>
										<SelectItem value="per_user_oauth">{t("mcpRegistry.libraryAdd.auth.perUserOAuth")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mcp-add-category">{t("mcpRegistry.libraryAdd.fields.category")}</Label>
								<Input
									id="mcp-add-category"
									placeholder={t("mcpRegistry.libraryAdd.placeholders.category")}
									data-testid="mcp-add-category-input"
									{...register("category")}
								/>
							</div>
						</div>

						{needsHeaderKeys && (
							<div className="space-y-2">
								<Label htmlFor="mcp-add-header-keys">{t("mcpRegistry.libraryAdd.fields.requiredHeaderKeys")}</Label>
								<Input
									id="mcp-add-header-keys"
									placeholder={t("mcpRegistry.libraryAdd.placeholders.headerKeys")}
									data-testid="mcp-add-header-keys-input"
									{...register("required_header_keys")}
								/>
								<p className="text-muted-foreground text-xs">{t("mcpRegistry.libraryAdd.help.onlyNamesAtInstall")}</p>
							</div>
						)}

						{/* Optional metadata */}
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="mcp-add-icon">{t("mcpRegistry.libraryAdd.fields.iconUrl")}</Label>
								<Input id="mcp-add-icon" placeholder="https://..." data-testid="mcp-add-icon-input" {...register("icon_url")} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="mcp-add-docs">{t("mcpRegistry.libraryAdd.fields.docsUrl")}</Label>
								<Input id="mcp-add-docs" placeholder="https://..." data-testid="mcp-add-docs-input" {...register("docs_url")} />
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="mcp-add-tags">{t("mcpRegistry.libraryAdd.fields.tags")}</Label>
							<Input
								id="mcp-add-tags"
								placeholder={t("mcpRegistry.libraryAdd.placeholders.tags")}
								data-testid="mcp-add-tags-input"
								{...register("tags")}
							/>
						</div>
					</div>

					<div className="border-border bg-card sticky bottom-0 z-10 border-t px-8 py-4">
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onClose} disabled={isLoading} data-testid="mcp-add-cancel-btn">
								{t("common.actions.cancel")}
							</Button>
							<Button type="submit" disabled={isLoading} data-testid="mcp-add-submit-btn">
								{isLoading ? t("mcpRegistry.libraryAdd.actions.publishing") : t("mcpRegistry.libraryAdd.actions.publishToLibrary")}
							</Button>
						</div>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}