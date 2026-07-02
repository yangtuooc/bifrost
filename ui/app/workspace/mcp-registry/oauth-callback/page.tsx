// 上游 OAuth callback 的落地页。后端完成 token exchange 后跳回这里，页面再通知 opener 并关闭自己。
// 如果没有 opener（用户直接打开 URL），则展示一个可返回 MCP registry 的 fallback。

import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function MCPRegistryOAuthCallbackPage() {
	const { t } = useTranslation();
	const [closeAttempted, setCloseAttempted] = useState(false);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const status = params.get("status");
		const error = params.get("error");

		if (window.opener) {
			if (status === "success") {
				window.opener.postMessage({ type: "oauth_success" }, window.location.origin);
			} else {
				window.opener.postMessage(
					{ type: "oauth_failed", error: error ?? t("mcpRegistry.authorizers.oauth.flowFailed") },
					window.location.origin,
				);
			}
			setCloseAttempted(true);
			window.close();
		}
	}, [t]);

	// 如果执行到这里，说明没有 opener 或 close 被阻止；渲染 fallback 避免空白页。
	const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
	const status = params?.get("status") ?? "unknown";
	const error = params?.get("error");

	return (
		<div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
			<div className="bg-card w-full rounded-lg border p-8 text-center shadow-sm">
				<h1 className="text-xl font-semibold">
					{status === "success" ? t("mcpRegistry.authorizers.callback.complete") : t("mcpRegistry.authorizers.callback.failed")}
				</h1>
				{error && <p className="text-destructive mt-2 text-sm">{error}</p>}
				<p className="text-muted-foreground mt-4 text-sm">
					{closeAttempted ? t("mcpRegistry.authorizers.callback.canCloseAfterAttempt") : t("mcpRegistry.authorizers.callback.canClose")}
				</p>
				<div className="mt-6">
					<Button asChild variant="outline" data-testid="mcp-callback-back-button">
						<Link to="/workspace/mcp-registry">{t("mcpRegistry.authorizers.callback.backToRegistry")}</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}