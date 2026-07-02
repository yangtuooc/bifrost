import { describe, expect, it } from "vitest";

import { i18nCoverageModules } from "./coverage";

describe("i18n coverage matrix", () => {
	it("tracks the core routes required by the full-coverage goal", () => {
		const routes = new Set<string>(i18nCoverageModules.map((module) => module.route));

		for (const route of [
			"/workspace/dashboard",
			"/workspace/logs",
			"/workspace/mcp-logs",
			"/workspace/model-catalog",
			"/workspace/providers",
			"/workspace/mcp-registry",
			"/workspace/mcp-registry/library",
			"/workspace/model-limits",
			"/workspace/routing-rules",
			"/workspace/plugins",
			"/workspace/governance",
			"/workspace/governance/virtual-keys",
			"/workspace/config/client-settings",
			"/workspace/oauth-grants",
			"/workspace/skills-repo",
			"development-overlay",
			"shared-ui",
		]) {
			expect(routes.has(route), route).toBe(true);
		}
	});

	it("records retained English terms and audit notes for every module", () => {
		for (const module of i18nCoverageModules) {
			expect(module.id).not.toHaveLength(0);
			expect(module.owner).not.toHaveLength(0);
			expect(module.status).toBe("covered");
			expect(module.notes).not.toHaveLength(0);
			expect(module.retainedEnglish.length, module.id).toBeGreaterThan(0);
		}
	});
});