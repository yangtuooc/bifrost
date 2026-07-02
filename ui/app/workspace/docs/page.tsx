import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GradientHeader from "@/components/ui/gradientHeader";
import { BookOpen, Code, ExternalLink, FileText, GitBranch, Play, Shield, Users, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

const docSections = [
	{
		id: "quick-start",
		translationKey: "quickStart",
		icon: Play,
		url: "https://github.com/maximhq/bifrost/tree/main/docs/quickstart",
		badgeKey: "popular",
		itemKeys: ["httpTransportSetup", "goPackageUsage", "dockerGuide"],
	},
	{
		id: "architecture",
		translationKey: "architecture",
		icon: GitBranch,
		url: "https://github.com/maximhq/bifrost/tree/main/docs/architecture",
		itemKeys: ["systemOverview", "requestFlow", "concurrencyModel", "designDecisions"],
	},
	{
		id: "usage-guides",
		translationKey: "usageGuides",
		icon: BookOpen,
		url: "https://github.com/maximhq/bifrost/tree/main/docs/usage",
		badgeKey: "comprehensive",
		itemKeys: ["providersSetup", "keyManagement", "errorHandling", "memoryNetworking"],
	},
	{
		id: "contributing",
		translationKey: "contributing",
		icon: Users,
		url: "https://github.com/maximhq/bifrost/tree/main/docs/contributing",
		itemKeys: ["contributingGuide", "addingProviders", "pluginDevelopment", "codeConventions"],
	},
	{
		id: "integration-examples",
		translationKey: "integrationExamples",
		icon: Code,
		url: "https://github.com/maximhq/bifrost/tree/main/docs/usage/http-transport/integrations",
		itemKeys: ["openaiIntegration", "anthropicIntegration", "genaiIntegration", "migrationGuides"],
	},
	{
		id: "benchmarks",
		translationKey: "benchmarks",
		icon: Zap,
		url: "https://github.com/maximhq/bifrost/blob/main/docs/benchmarks.md",
		itemKeys: ["rpsResults", "performanceMetrics", "configurationTuning", "hardwareComparisons"],
	},
];

const featuredDocs = [
	{
		id: "mcp-documentation",
		translationKey: "mcpDocumentation",
		href: "https://github.com/maximhq/bifrost/blob/main/docs/mcp.md",
		icon: FileText,
		borderColor: "border-primary/20",
		backgroundColor: "bg-primary/5",
		iconColor: "text-primary",
	},
	{
		id: "governance-plugin",
		translationKey: "governancePlugin",
		href: "https://github.com/maximhq/bifrost/blob/main/docs/governance.md",
		icon: Shield,
		borderColor: "border-green-200 dark:border-green-800",
		backgroundColor: "bg-green-50 dark:bg-green-950/20",
		iconColor: "text-green-600",
	},
];

export default function DocsPage() {
	const { t } = useTranslation();

	return (
		<div className="dark:bg-card bg-white">
			<div className="mx-auto max-w-7xl">
				<div className="space-y-8">
					{/* Header */}
					<div className="space-y-4 text-center">
						<div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
							<BookOpen className="h-4 w-4" />
							<span className="font-semibold">{t("docsPage.hero.badge")}</span>
						</div>
						<GradientHeader title={t("docsPage.hero.title")} />
						<p className="text-muted-foreground mx-auto max-w-2xl text-lg">{t("docsPage.hero.description")}</p>
						<div className="flex justify-center gap-4">
							<Button asChild>
								<a
									href="https://github.com/maximhq/bifrost/tree/main/docs"
									target="_blank"
									rel="noopener noreferrer"
									data-testid="docs-view-full-documentation-link"
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									{t("docsPage.hero.viewFullDocumentation")}
								</a>
							</Button>
							<Button variant="outline" asChild>
								<a
									href="https://github.com/maximhq/bifrost/tree/main/docs/quickstart"
									target="_blank"
									rel="noopener noreferrer"
									data-testid="docs-quick-start-guide-link"
								>
									<Play className="mr-2 h-4 w-4" />
									{t("docsPage.hero.quickStartGuide")}
								</a>
							</Button>
						</div>
					</div>

					{/* Documentation Sections */}
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{docSections.map((section) => {
							const Icon = section.icon;
							return (
								<Card key={section.id} className="group transition-all duration-200 hover:shadow-lg">
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="bg-primary/10 group-hover:bg-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors">
												<Icon className="text-primary h-6 w-6" />
											</div>
											{section.badgeKey && (
												<Badge variant="secondary" className="text-xs">
													{t(`docsPage.badges.${section.badgeKey}`)}
												</Badge>
											)}
										</div>
										<CardTitle className="text-xl">{t(`docsPage.sections.${section.translationKey}.title`)}</CardTitle>
										<CardDescription className="leading-relaxed">
											{t(`docsPage.sections.${section.translationKey}.description`)}
										</CardDescription>
									</CardHeader>
									<CardContent className="flex h-full flex-col justify-between gap-8">
										<div className="space-y-4">
											<ul className="space-y-2">
												{section.itemKeys.map((itemKey) => (
													<li key={itemKey} className="text-muted-foreground flex items-center gap-2 text-sm">
														<div className="bg-primary h-1.5 w-1.5 rounded-full" />
														{t(`docsPage.sections.${section.translationKey}.items.${itemKey}`)}
													</li>
												))}
											</ul>
										</div>
										<Button asChild variant="outline" className="w-full">
											<a
												href={section.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center justify-center gap-2"
												data-testid={`docs-read-more-${section.id}`}
											>
												{t("common.actions.readMore")}
												<ExternalLink className="h-4 w-4" />
											</a>
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>

					{/* Featured Documentation */}
					<div className="grid gap-6 pt-8 md:grid-cols-2">
						{featuredDocs.map((doc, index) => (
							<Card className={`${doc.borderColor} ${doc.backgroundColor}`} key={doc.id}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<doc.icon className={`h-5 w-5 ${doc.iconColor}`} />
										{t(`docsPage.featured.${doc.translationKey}.title`)}
									</CardTitle>
									<CardDescription>{t(`docsPage.featured.${doc.translationKey}.description`)}</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground mb-4 text-sm">{t(`docsPage.featured.${doc.translationKey}.content`)}</p>
									<Button asChild className="w-full">
										<a href={doc.href} target="_blank" rel="noopener noreferrer" data-testid={`docs-featured-${doc.id}`}>
											<doc.icon className="mr-2 h-4 w-4" />
											{t(`docsPage.featured.${doc.translationKey}.button`)}
										</a>
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}