import { Button } from "@/components/ui/button";
import { ArrowUpRight, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePromptContext } from "../context";

export function EmptyState() {
	const { t } = useTranslation();
	const { setPromptSheet, canCreate } = usePromptContext();

	return (
		<div className="text-muted-foreground flex h-full items-center justify-center">
			<div className="text-center">
				<p className="text-lg font-medium">{t("prompts.empty.noPromptSelected")}</p>
				<p className="text-sm">
					{canCreate ? (
						<>
							{t("prompts.empty.selectPromptFromSidebar")}{" "}
							<Button
								variant="link"
								className="h-auto p-0 text-sm"
								data-testid="empty-state-create-prompt-link"
								onClick={() => setPromptSheet({ open: true })}
							>
								{t("prompts.empty.createNewOne")}
							</Button>
						</>
					) : (
						t("prompts.empty.selectPromptFromSidebar")
					)}
				</p>
			</div>
		</div>
	);
}

export function PromptsEmptyState() {
	const { t } = useTranslation();
	const { setPromptSheet, canCreate } = usePromptContext();

	return (
		<div className="flex min-h-[80vh] w-full flex-col items-center justify-center gap-4 py-16 text-center">
			<div className="text-muted-foreground">
				<SquareTerminal className="h-[5.5rem] w-[5.5rem]" strokeWidth={1} />
			</div>
			<div className="flex flex-col gap-1">
				<h1 className="text-muted-foreground text-xl font-medium">{t("prompts.empty.heroTitle")}</h1>
				<div className="text-muted-foreground mx-auto mt-2 max-w-[600px] text-sm font-normal">
					{canCreate ? t("prompts.empty.heroCreateDescription") : t("prompts.empty.heroReadDescription")}
				</div>
				<div className="mx-auto mt-6 flex flex-row flex-wrap items-center justify-center gap-2">
					<Button
						variant="outline"
						aria-label={t("prompts.empty.readMoreAria")}
						data-testid="empty-state-read-more"
						onClick={() => {
							window.open(`https://docs.getbifrost.ai/features/prompt-repository?utm_source=bfd`, "_blank", "noopener,noreferrer");
						}}
					>
						{t("common.actions.readMore")} <ArrowUpRight className="text-muted-foreground h-3 w-3" />
					</Button>
					{canCreate && (
						<Button
							aria-label={t("prompts.empty.createFirstPromptAria")}
							data-testid="empty-state-create-prompt"
							onClick={() => setPromptSheet({ open: true })}
						>
							{t("prompts.header.createPrompt")}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}