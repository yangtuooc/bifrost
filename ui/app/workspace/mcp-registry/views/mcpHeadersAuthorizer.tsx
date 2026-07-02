// MCPHeadersAuthorizer 复用 OAuth2Authorizer 的交互结构，但验证步骤改为内联填写 header 示例值。

import HeadersForm from "@/components/headersForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage, useCreateMCPClientMutation } from "@/lib/store";
import { CreateMCPClientRequest } from "@/lib/types/mcp";
import { Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface MCPHeadersAuthorizerProps {
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
	onError: (error: string) => void;
	onConflict?: (error: string) => void;
	// 父组件已组装好的完整 payload，弹窗只追加内联收集的 user_headers。
	payload: CreateMCPClientRequest;
	// 必填 header key schema，会渲染为表单输入项。
	perUserHeaderKeys: string[];
}

type Status = "confirm" | "input" | "testing" | "success" | "failed";

export const MCPHeadersAuthorizer: React.FC<MCPHeadersAuthorizerProps> = ({
	open,
	onClose,
	onSuccess,
	onError,
	onConflict,
	payload,
	perUserHeaderKeys,
}) => {
	const { t } = useTranslation();
	const [status, setStatus] = useState<Status>("confirm");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	// 用户取消后置为 true，避免未完成异步回调在弹窗关闭后触发外部状态。
	const cancelledRef = useRef(false);

	const [createMCPClient] = useCreateMCPClientMutation();

	// 每次打开弹窗都重置状态，避免上一次重试状态泄漏。
	useEffect(() => {
		if (open) {
			setStatus("confirm");
			setErrorMessage(null);
			cancelledRef.current = false;
		}
	}, [open]);

	const handleConfirm = () => {
		setStatus("input");
	};

	const handleRunTest = async (values: Record<string, string>) => {
		if (cancelledRef.current) return;
		setStatus("testing");
		try {
			await createMCPClient({ ...payload, user_headers: values }).unwrap();
			if (cancelledRef.current) return;
			setStatus("success");
			onSuccess();
		} catch (err) {
			if (cancelledRef.current) return;
			const errMsg = getErrorMessage(err);
			if ((err as any)?.status === 409) {
				setStatus("input");
				setErrorMessage(null);
				onConflict?.(errMsg);
				return;
			}
			setStatus("failed");
			setErrorMessage(errMsg);
			onError(errMsg);
		}
	};

	const handleRetry = () => {
		setErrorMessage(null);
		setStatus("input");
	};

	const handleCancel = () => {
		cancelledRef.current = true;
		onClose();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					handleCancel();
				}
			}}
		>
			<DialogContent
				className="sm:max-w-md"
				onPointerDownOutside={(e) => {
					e.preventDefault();
					handleCancel();
				}}
				onEscapeKeyDown={(e) => {
					e.preventDefault();
					handleCancel();
				}}
			>
				<DialogHeader>
					<DialogTitle>
						{status === "confirm"
							? t("mcpRegistry.authorizers.headers.titles.confirm")
							: t("mcpRegistry.authorizers.headers.titles.default")}
					</DialogTitle>
					<DialogDescription>
						{status === "confirm" && t("mcpRegistry.authorizers.headers.descriptions.confirm")}
						{status === "input" && t("mcpRegistry.authorizers.headers.descriptions.input")}
						{status === "testing" && t("mcpRegistry.authorizers.headers.descriptions.testing")}
						{status === "success" && t("mcpRegistry.authorizers.headers.descriptions.success")}
						{status === "failed" && t("mcpRegistry.authorizers.headers.descriptions.failed")}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col space-y-4">
					{status === "confirm" && (
						<>
							<div className="text-muted-foreground space-y-3 text-sm">
								<p>{t("mcpRegistry.authorizers.headers.confirm.setup")}</p>
								<p>
									{t("mcpRegistry.authorizers.headers.confirm.oneTimeStart")}{" "}
									<strong>{t("mcpRegistry.authorizers.headers.confirm.oneTimeStrong")}</strong>{" "}
									{t("mcpRegistry.authorizers.headers.confirm.oneTimeMiddle")}{" "}
									<strong>{t("mcpRegistry.authorizers.headers.confirm.notStrong")}</strong>{" "}
									{t("mcpRegistry.authorizers.headers.confirm.oneTimeEnd")}
								</p>
								<p>{t("mcpRegistry.authorizers.headers.confirm.userValues")}</p>
							</div>
							<div className="flex w-full justify-end space-x-2">
								<Button onClick={handleCancel} variant="outline" data-testid="per-user-headers-cancel">
									{t("common.actions.cancel")}
								</Button>
								<Button onClick={handleConfirm} data-testid="per-user-headers-confirm">
									{t("mcpRegistry.authorizers.headers.confirm.continueWithTest")}
								</Button>
							</div>
						</>
					)}

					{status === "input" && (
						<>
							<p className="text-muted-foreground text-sm">
								{t("mcpRegistry.authorizers.headers.input.valuesOnly")}{" "}
								<strong>{t("mcpRegistry.authorizers.headers.input.notPersisted")}</strong>{" "}
								{t("mcpRegistry.authorizers.headers.input.valuesSuffix")}
							</p>
							<HeadersForm
								requiredKeys={perUserHeaderKeys}
								onSubmit={handleRunTest}
								submitLabel={t("mcpRegistry.authorizers.headers.input.runTest")}
								onCancel={handleCancel}
								testIdPrefix="per-user-headers-admin-test"
							/>
						</>
					)}

					{status === "testing" && (
						<>
							<div className="flex flex-col items-center space-y-2">
								<Loader2 className="text-secondary-foreground h-4 w-4 animate-spin" />
								<p className="text-muted-foreground text-sm">{t("mcpRegistry.authorizers.headers.testing")}</p>
							</div>
						</>
					)}

					{status === "success" && (
						<div className="flex flex-col items-center space-y-2">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
								<svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<p className="text-sm text-green-600">{t("mcpRegistry.authorizers.headers.success")}</p>
						</div>
					)}

					{status === "failed" && (
						<div className="flex flex-col items-center space-y-2">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
								<svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</div>
							<p className="text-sm text-red-600">{errorMessage || t("mcpRegistry.authorizers.headers.failedFallback")}</p>
							<Button onClick={handleRetry} variant="outline" data-testid="mcp-headers-authorizer-retry-btn">
								{t("common.actions.retry")}
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};