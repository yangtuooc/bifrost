import { describe, expect, it } from "vitest";

import { en } from "./locales/en";
import { zh } from "./locales/zh";

describe("i18n resources", () => {
	it("defines matching top-level namespaces for English and Chinese", () => {
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
	});

	it("keeps technical identifiers in provider translations", () => {
		expect(en.providers.keys.headers.apiKey).toBe("API Key");
		expect(zh.providers.keys.headers.apiKey).toBe("API Key");
	});
});