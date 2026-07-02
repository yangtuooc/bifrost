import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const hardcodedUiStringsByFile: Record<string, readonly string[]> = {
	"app/workspace/dashboard/page.tsx": [
		">Dashboard<",
		">Overview<",
		">Provider Usage<",
		">Model Rankings<",
		">MCP usage<",
		">Team Rankings<",
		">User Rankings<",
		">Virtual Key Rankings<",
		">Customer Rankings<",
		">BU Rankings<",
		'placeholder="All Tools"',
		'placeholder="All Servers"',
		'dimensionLabel="Team"',
		'dimensionLabel="Customer"',
		'dimensionLabel="Business Unit"',
		'dimensionLabel="User"',
		'dimensionLabel="Virtual Key"',
	],
	"app/workspace/dashboard/components/exportPopover.tsx": [
		'"Exporting..."',
		'"Export"',
		'"Powered by"',
		'"Overview"',
		'"Provider Usage"',
		'"Model Rankings"',
		'"MCP Usage"',
	],
	"app/workspace/logs/views/emptyState.tsx": [
		"Looks like you haven't configured the log store in your config file.",
		">Integrate under 60 seconds<",
		">Send your first request to get started<",
	],
	"app/workspace/model-catalog/views/modelCatalogView.tsx": [">Overview<", ">Models<"],
	"app/workspace/model-catalog/views/modelCatalogEmptyState.tsx": [
		">No providers configured yet<",
		"Configure your first model provider",
		">Configure Providers<",
	],
	"app/workspace/mcp-registry/page.tsx": ['title: "Error"'],
	"app/workspace/mcp-registry/views/mcpServersEmptyState.tsx": [
		">MCP servers connect tools and context to the gateway<",
		"Add MCP servers to expose tools",
		'aria-label="Read more about MCP servers',
		'aria-label="Add your first MCP server"',
		">Read more",
		">Add MCP Server<",
		">Browse Library<",
	],
	"app/workspace/plugins/views/pluginsEmptyState.tsx": [
		">Custom plugins extend Bifrost with your own business logic<",
		"Build and deploy plugins for custom integrations",
		'aria-label="Read more about custom plugins',
		'aria-label="Create your first plugin"',
		">Read more",
		">Install New Plugin<",
	],
	"app/workspace/virtual-keys/views/virtualKeysEmptyState.tsx": [
		">Virtual keys control access, budgets, and rate limits<",
		"Create virtual keys to assign permissions",
		'aria-label="Read more about virtual keys',
		'aria-label="Add your first virtual key"',
		">Read more",
		">Add Virtual Key<",
	],
	"app/workspace/config/views/clientSettingsView.tsx": [
		">Client Settings<",
		">Configure client behavior and request handling.<",
		">Header Forwarding<",
		">Control which extra headers are forwarded to LLM providers.<",
		">About Header Forwarding<",
		">Security Note<",
		">Allowlist<",
		">Denylist<",
		">Add Header<",
		'"Saving..."',
		'"Save Changes"',
	],
	"components/devProfiler.tsx": [
		">Dev Profiler<",
		'aria-label="Show Dev Profiler"',
		'"Failed to load profiling data"',
		">CPU Usage<",
		">Heap Alloc<",
		">Heap In-Use<",
		">System<",
		">Goroutines<",
		">GC Pause<",
		">Top Allocations<",
		">Goroutine Health<",
	],
	"components/trialExpiryBanner.tsx": [
		"I need help with my expired enterprise trial",
		"I need help extending my enterprise trial",
		"Your Bifrost Enterprise Trial has expired.",
		"Your Bifrost Enterprise Trial expires in",
		">Contact us<",
		"if you need any assistance.",
	],
	"components/noPermissionView.tsx": [
		"You don't have permission to view",
		"Contact your administrator to request access to this resource.",
	],
	"components/formFooter.tsx": [
		"You don't have permission to perform this action",
		">Cancel<",
		'"Saving..."',
		"Please fix validation errors",
		"`Update ${label}`",
		"`Create ${label}`",
	],
	"components/ui/searchSelect.tsx": ['searchPlaceholder = "Search..."', 'emptyMessage = "No results found."', '"Failed to load."'],
	"components/ui/custom/dropdown/searchableDropdown.tsx": ['searchPlaceholder = "Search"', 'noResultsText = "No results found"'],
	"components/ui/custom/celBuilder/valueEditor.tsx": [
		"Enter comma-separated values or JSON array",
		"e.g., .* (any), openai|anthropic (multiple), ^gpt.* (prefix)",
		"Enter value...",
	],
	"components/ui/custom/number.tsx": [
		"Value cannot be less than",
		"Value cannot be greater than",
		"Value cannot be empty",
		"Invalid number format",
		"Decimal numbers are not allowed",
		"Negative numbers are not allowed",
	],
	"components/prompts/fragments/sidebar.tsx": ["No results found", "No prompts yet"],
	"app/workspace/logs/views/speechView.tsx": ["Failed to load audio player", "Unknown error", "Speech Input", "Speech Output"],
	"app/workspace/logs/views/audioPlayer.tsx": [
		"Failed to decode audio data. The audio file may be corrupted.",
		"Failed to play audio. Please try again.",
		">Pause<",
		">Play<",
		">Download<",
	],
	"app/workspace/mcp-logs/views/columns.tsx": ['"Invalid date"'],
	"app/workspace/mcp-logs/views/mcpLogDetailsSheet.tsx": ['"Invalid date"'],
	"app/workspace/virtual-keys/views/virtualKeySheet.tsx": ['"All models"', '"No models (deny all)"'],
	"app/workspace/virtual-keys/views/virtualKeysTable.tsx": [
		'"Name"',
		'"Status"',
		'"Assigned To"',
		'"Budget Limit"',
		'"Budget Spent"',
		'"Budget Reset"',
		'"Description"',
		'"Created At"',
		'"Exhausted"',
		'"Active"',
		'"Inactive"',
	],
	"app/workspace/routing-rules/tree/views/node/rfRuleNode.tsx": [
		"Chain rule — resolved provider/model feeds back as the new input and the full scope chain re-evaluates.",
		'"Resolved target (new input)"',
		'"Targets"',
		">Off<",
		">Priority ",
		" target{",
		'"Passthrough"',
		"original provider &amp; model",
	],
	"app/workspace/routing-rules/tree/views/constants.ts": [
		'label: "Virtual Key"',
		'label: "Team"',
		'label: "Customer"',
		'label: "Global"',
	],
};

const scannedDirectories = ["app", "components"] as const;
const scannedFiles = [] as const;

const visibleEnglishPatterns = [
	{
		name: "JSX text node",
		pattern: />\s*[A-Z][A-Za-z][^<{]*</,
	},
	{
		name: "string prop",
		pattern: /(placeholder|aria-label|title|label|description)="[A-Z][^"]+"/,
	},
	{
		name: "toast message",
		pattern: /toast\.(success|error|warning|info)\("[A-Z][^"]+"/,
	},
	{
		name: "toast object field",
		pattern: /(title|description): "[A-Z][^"]+"/,
	},
	{
		name: "object label/message field",
		pattern: /\b(label|message): "[A-Z][^"]+"/,
	},
	{
		name: "default placeholder",
		pattern: /\bplaceholder\s*=\s*"[A-Z][^"]+"/,
	},
	{
		name: "toast template message",
		pattern: /toast\.(success|error|warning|info)\(`[A-Z][^`]+`/,
	},
] as const;

function walkTsxFiles(relativeDir: string): string[] {
	const absoluteDir = join(process.cwd(), relativeDir);
	return readdirSync(absoluteDir).flatMap((entry) => {
		const relativePath = `${relativeDir}/${entry}`;
		if (relativePath.startsWith("app/_fallbacks")) return [];
		const absolutePath = join(process.cwd(), relativePath);
		if (statSync(absolutePath).isDirectory()) return walkTsxFiles(relativePath);
		return relativePath.endsWith(".tsx") ? [relativePath] : [];
	});
}

function isAllowedMatch(line: string): boolean {
	return (
		line.includes("=> Promise<") ||
		line.includes("Python") ||
		line.includes("TypeScript") ||
		line.includes("JSON") ||
		line.includes("N/A") ||
		line.includes("SVG") ||
		line.includes("URL.createObjectURL") ||
		line.includes("SKILL.md") ||
		line.includes("Claude Code") ||
		line.includes("Codex") ||
		line.includes('label: "Cursor"') ||
		line.includes('label: "VS Code"') ||
		line.includes('label: "OpenCode"') ||
		line.includes('label: "Windsurf (Devin)"') ||
		line.includes('label: "Antigravity"') ||
		line.includes('label: "macOS"') ||
		line.includes('label: "Windows"') ||
		line.includes('label: "Linux"') ||
		line.includes('label: "HTTP"') ||
		line.includes('label: "GRPC"') ||
		line.includes("Bash Read Grep") ||
		line.includes("MIT") ||
		line.includes("Promise<void>") ||
		line.includes("Partial<DashboardData>") ||
		line.includes("as Record<") ||
		line.includes("Record<string, string>") ||
		line.includes('title: "Routing Tree | Bifrost"') ||
		line.includes('description: "Read-only decision tree visualization of routing rules"') ||
		line.includes('placeholder="HH"') ||
		line.includes('placeholder="MM"') ||
		line.includes('placeholder="AM"') ||
		line.includes('<SelectItem value="AM">AM</SelectItem>') ||
		line.includes('<SelectItem value="PM">PM</SelectItem>') ||
		line.includes("<title>OpenAI icon</title>") ||
		line.includes("<title>JavaScript</title>") ||
		line.includes("<title>Go</title>") ||
		line.includes("<title>Java</title>") ||
		line.includes("<title>Agno</title>") ||
		line.includes("<title>Anthropic</title>") ||
		line.includes("<title>CrewAI</title>") ||
		line.includes("<title>Gemini</title>") ||
		line.includes("<title>Groq</title>") ||
		line.includes("<title>OpenAI</title>") ||
		line.includes("<title>LiteLLM</title>") ||
		line.includes("<title>LangChain</title>") ||
		line.includes("<title>LangGraph</title>") ||
		line.includes("<title>Mistral AI</title>") ||
		line.includes("<title>LiveKit</title>") ||
		line.includes("<title>ModelContextProtocol</title>") ||
		line.includes("MCP server") ||
		line.includes("MCP client") ||
		line.includes("MCP gateway") ||
		line.includes("OAuth") ||
		line.includes("Authorization") ||
		line.includes("x-api-key") ||
		line.includes("x-goog-api-key") ||
		line.includes("x-bf-direct-key") ||
		line.includes("VK") ||
		line.includes("SSO") ||
		line.includes("PerUserHeaderKeys") ||
		line.includes("BuildUpstreamAuthorizeURL") ||
		line.includes("Active / Needs update") ||
		line.includes('<SelectItem value="openai">OpenAI</SelectItem>') ||
		line.includes('<SelectItem value="anthropic">Anthropic</SelectItem>') ||
		line.includes('<SelectItem value="gemini">Gemini</SelectItem>') ||
		line.includes('<SelectItem value="cohere">Cohere</SelectItem>') ||
		line.includes('<SelectItem value="bedrock">AWS Bedrock</SelectItem>') ||
		line.includes('<SelectItem value="replicate">Replicate</SelectItem>') ||
		line.includes('<SelectItem value="http">HTTP</SelectItem>') ||
		line.includes('<SelectItem value="socks5">SOCKS5</SelectItem>') ||
		line.includes('new Error("Download failed")') ||
		line.includes('e.key === "Enter"') ||
		line.includes('e.key === "Escape"')
	);
}

describe("i18n static coverage", () => {
	it("does not keep core route-level UI strings hardcoded in English", () => {
		for (const [relativePath, forbiddenStrings] of Object.entries(hardcodedUiStringsByFile)) {
			const content = readFileSync(join(process.cwd(), relativePath), "utf8");
			for (const forbidden of forbiddenStrings) {
				expect(content.includes(forbidden), `${relativePath} should use locale resources instead of ${forbidden}`).toBe(false);
			}
		}
	});

	it("keeps cleaned route modules free of high-signal hardcoded English UI strings", () => {
		const violations: string[] = [];
		const files = [...scannedDirectories.flatMap((directory) => walkTsxFiles(directory)), ...scannedFiles];

		for (const relativePath of files) {
			const lines = readFileSync(join(process.cwd(), relativePath), "utf8").split("\n");
			lines.forEach((line, index) => {
				if (isAllowedMatch(line)) return;
				for (const rule of visibleEnglishPatterns) {
					if (rule.pattern.test(line)) {
						violations.push(`${relativePath}:${index + 1} ${rule.name}: ${line.trim()}`);
					}
				}
			});
		}

		expect(violations).toEqual([]);
	});
});
