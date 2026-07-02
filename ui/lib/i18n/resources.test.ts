import { describe, expect, it } from "vitest";

import { en } from "./locales/en";
import { zh } from "./locales/zh";

function getByPath(resource: unknown, path: string): unknown {
	return path.split(".").reduce<unknown>((current, segment) => {
		if (!current || typeof current !== "object") return undefined;
		return (current as Record<string, unknown>)[segment];
	}, resource);
}

describe("i18n resources", () => {
	it("defines matching top-level namespaces for English and Chinese", () => {
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
	});

	it("defines matching nested keys for English and Chinese", () => {
		const flattenKeys = (value: unknown, prefix = ""): string[] => {
			if (!value || typeof value !== "object") return [prefix];
			return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
				flattenKeys(child, prefix ? `${prefix}.${key}` : key),
			);
		};

		expect(flattenKeys(zh).sort()).toEqual(flattenKeys(en).sort());
	});

	it("includes representative full-coverage page keys", () => {
		for (const key of [
			"dashboard.title",
			"logs.empty.title",
			"modelCatalog.tabs.overview",
			"mcpLogs.filters.title",
			"mcpRegistry.empty.title",
			"mcpRegistry.form.title",
			"mcpRegistry.library.filters.title",
			"mcpRegistry.library.page.title",
			"mcpRegistry.library.settings.title",
			"mcpRegistry.library.deleteDialog.remove",
			"mcpRegistry.authorizers.oauth.titles.confirm",
			"mcpRegistry.authorizers.headers.titles.confirm",
			"mcpRegistry.authorizers.callback.backToRegistry",
			"mcpSessions.table.title",
			"oauthGrants.page.title",
			"oauthGrants.filters.searchPlaceholder",
			"oauthGrants.actions.revoke",
			"oauthGrants.revokeDialog.title",
			"oauthGrants.table.client",
			"logs.ocr.input",
			"logs.details.messageBlocks.toolCall",
			"logs.details.requestTypes.imageGeneration",
			"logs.details.sections.videoListOutput",
			"logs.details.audioPlayer.decodeFailed",
			"logs.details.media.attachedFile",
			"logs.details.empty.noResponsesMessages",
			"logs.statusCards.totalRequests",
			"logs.header.recalculate.loading",
			"logs.table.message",
			"logs.table.noResults",
			"logs.settingsSheets.loggingTitle",
			"logs.sessionDetails.loadMore",
			"logs.volume.requestVolume",
			"dashboard.table.successRate",
			"dashboard.metrics.totalRequests",
			"dashboard.metrics.other",
			"dashboard.filters.allProviders",
			"dashboard.cache.externalCacheInfo",
			"dashboard.cache.localCacheRequests",
			"dashboard.rankings.topDimensions",
			"dashboard.rankings.noUsageData",
			"complexityRouter.title",
			"complexityRouter.validation.numberBetweenZeroAndOne",
			"common.dateTimePicker.pickDate",
			"common.table.columnConfiguration",
			"common.sheetNavigation.previousAria",
			"common.errorPage.title",
			"common.notFound.title",
			"common.select.searchOptions",
			"common.select.addValue",
			"common.select.failedToLoad",
			"common.entityAssociation.placeholders.virtualKey",
			"common.entityAssociation.noOptions.provider",
			"common.status.beta",
			"common.noPermission.title",
			"common.formFooter.createLabel",
			"common.modelSelect.allModels",
			"common.celBuilder.loading",
			"common.numberInput.invalidFormat",
			"common.command.title",
			"common.dateTimePicker.invalidDate",
			"common.secretVar.resolvedAfterSaving",
			"sidebar.descriptions.observability",
			"sidebar.descriptions.featureFlags",
			"trialExpiry.contactUs",
			"oauthConsent.header.wantsToConnect",
			"mcpRegistry.usageGuide.title",
			"mcpRegistry.usageGuide.command.configCopied",
			"mcpRegistry.usageGuide.scopes.workspace",
			"mcpRegistry.usageGuide.registration.singleServer",
			"mcpRegistry.libraryInstall.errors.serverNameRequired",
			"mcpRegistry.selectors.noToolsSelected",
			"mcpRegistry.selectors.noServersSelected",
			"headersTable.duplicateKey",
			"routingRules.tree.title",
			"routingRules.tree.passthrough",
			"routingRules.tree.targetCount_one",
			"routingRules.tree.targetCount_other",
			"routingRules.tree.off",
			"routingRules.tree.priority",
			"config.observability.fields.prometheusLabels",
			"observability.maxim.save",
			"observability.maxim.configuration",
			"observability.otel.toasts.updated",
			"observability.prometheus.toasts.updated",
			"observability.pluginTracing.title",
			"loggingDisabled.title",
			"notAvailable.title",
			"headersForm.staticAdminHeaders",
			"docsPage.hero.title",
			"customPricing.overrides.title",
			"customPricing.overrides.sheet.createTitle",
			"customPricing.overrides.pricingFields.input_cost_per_token",
			"providers.customProviderSheet.title",
			"providers.config.network.fields.baseUrl",
			"providers.config.proxy.fields.proxyType",
			"providers.config.apiStructure.fields.baseProviderType",
			"providers.config.performance.fields.concurrency",
			"providers.config.debugging.fields.sendBackRawRequest",
			"providers.config.governance.rateLimitingTitle",
			"providers.config.allowedRequests.title",
			"providers.config.openaiConfig.fields.disableStore",
			"governance.teams.title",
			"governance.common.toasts.loadGovernanceDataFailed",
			"governance.teams.sheet.createTitle",
			"governance.customers.title",
			"governance.customers.sheet.createTitle",
			"plugins.page.installNew",
			"plugins.empty.title",
			"plugins.view.configurationTitle",
			"plugins.form.validation.nameRequired",
			"plugins.sheet.installTitle",
			"plugins.deleteDialog.title",
			"plugins.sequence.title",
			"virtualKeys.empty.title",
			"virtualKeys.sheet.title.create",
			"virtualKeys.sheet.validation.assignmentRequired",
			"virtualKeys.table.export.headers.name",
			"config.clientSettings.title",
			"config.security.title",
			"config.modelSettings.title",
			"config.pricing.title",
			"config.performance.title",
			"config.compatibility.title",
			"config.featureFlags.title",
			"config.logging.title",
			"devProfiler.title",
			"modelLimits.toasts.loadModelConfigsFailed",
			"onboarding.title",
			"onboarding.steps.providerKey",
			"prompts.header.saveSession",
			"prompts.empty.heroTitle",
			"prompts.sheet.prompt.createTitle",
			"prompts.commit.title",
			"prompts.settings.configuration",
			"prompts.sidebar.searchPlaceholder",
			"prompts.sidebar.noResults",
			"prompts.messages.enterUserMessage",
			"prompts.messages.roles.system",
			"prompts.toolCalls.awaitingToolResult",
			"prompts.toasts.executeToolFailed",
		]) {
			expect(getByPath(en, key), `en.${key}`).toBeTypeOf("string");
			expect(getByPath(zh, key), `zh.${key}`).toBeTypeOf("string");
		}
	});

	it("keeps technical identifiers in provider translations", () => {
		expect(en.providers.keys.headers.apiKey).toBe("API Key");
		expect(zh.providers.keys.headers.apiKey).toBe("API Key");
	});
});
