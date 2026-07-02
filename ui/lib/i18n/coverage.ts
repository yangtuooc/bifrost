export type I18nCoverageStatus = "covered" | "partial" | "dynamic-data" | "out-of-scope";

export interface I18nCoverageModule {
	id: string;
	route: string;
	owner: string;
	status: I18nCoverageStatus;
	retainedEnglish: readonly string[];
	notes: string;
}

export const i18nCoverageModules = [
	{
		id: "dashboard",
		route: "/workspace/dashboard",
		owner: "ui/app/workspace/dashboard",
		status: "covered",
		retainedEnglish: ["LLM", "MCP", "Provider", "P90", "P95", "P99"],
		notes: "Dashboard 主页面、tab、chart title、legend、筛选器和 empty state 已纳入静态扫描；动态模型名、Provider 名和分位缩写保留原文。",
	},
	{
		id: "logs",
		route: "/workspace/logs",
		owner: "ui/app/workspace/logs",
		status: "covered",
		retainedEnglish: ["cURL", "OpenAI SDK", "Anthropic SDK", "Google GenAI SDK", "LiteLLM SDK", "LangChain SDK"],
		notes: "Logs 空状态、表格、详情 sheet、媒体视图、本地错误和音频控件已纳入静态扫描；代码示例、SDK 名称和原始日志 payload 保留原文。",
	},
	{
		id: "mcp-logs",
		route: "/workspace/mcp-logs",
		owner: "ui/app/workspace/mcp-logs",
		status: "covered",
		retainedEnglish: ["MCP", "JSON", "Python", "TypeScript", "Content-Type"],
		notes: "MCP Logs header、filters、table、column config、details sheet、empty state 标题已覆盖；示例代码和请求 payload 保留原文。",
	},
	{
		id: "model-catalog",
		route: "/workspace/model-catalog",
		owner: "ui/app/workspace/model-catalog",
		status: "covered",
		retainedEnglish: ["Provider", "API Key", "model ID"],
		notes: "Model Catalog tabs、空状态、表格、属性 sheet 和筛选文案已纳入静态扫描；模型 ID 和 Provider ID 保留原文。",
	},
	{
		id: "providers",
		route: "/workspace/providers",
		owner: "ui/app/workspace/providers",
		status: "covered",
		retainedEnglish: ["Provider", "API Key", "OpenAI", "Anthropic", "Bedrock"],
		notes:
			"Provider 入口、自定义 Provider sheet、API Key 表单、network/proxy/performance/governance/debug fragments 已纳入静态扫描；Provider ID、模型名和示例 URL 保留原文。",
	},
	{
		id: "mcp-registry",
		route: "/workspace/mcp-registry",
		owner: "ui/app/workspace/mcp-registry",
		status: "covered",
		retainedEnglish: ["MCP", "OAuth", "SSE", "STDIO", "HTTP"],
		notes:
			"MCP Registry 空状态、表格、操作菜单、toast、弹窗、OAuth/Header authorizer 和 usage guide 已纳入静态扫描；协议名、平台名和客户端产品名保留英文。",
	},
	{
		id: "mcp-library",
		route: "/workspace/mcp-registry/library",
		owner: "ui/app/workspace/mcp-registry/library",
		status: "covered",
		retainedEnglish: ["MCP", "OAuth 2.0", "stdio", "SSE", "npx"],
		notes: "MCP Library 列表、卡片、筛选 sidebar、安装 sheet、设置 sheet 和删除弹窗已纳入静态扫描；协议名、命令名和 catalog 数据保留原文。",
	},
	{
		id: "model-limits",
		route: "/workspace/model-limits",
		owner: "ui/app/workspace/model-limits",
		status: "covered",
		retainedEnglish: ["model ID", "Provider"],
		notes: "Model Limits 列表、空状态、sheet、toast 和模型选择控件已纳入静态扫描；模型 ID 和动态配置数据保留原文。",
	},
	{
		id: "routing-rules",
		route: "/workspace/routing-rules",
		owner: "ui/app/workspace/routing-rules",
		status: "covered",
		retainedEnglish: ["CEL", "Provider", "model", "Routing Tree | Bifrost"],
		notes:
			"Routing Rules 列表、空状态、sheet、info sheet 和 routing tree 节点标签已纳入静态扫描；CEL 表达式、Provider/model 值和静态 metadata 保留原文。",
	},
	{
		id: "plugins",
		route: "/workspace/plugins",
		owner: "ui/app/workspace/plugins",
		status: "covered",
		retainedEnglish: ["Bifrost", "WASM", "HTTP"],
		notes: "Plugins 空状态、列表、表单、安装 sheet、删除弹窗和 sequence sheet 已纳入静态扫描；插件 ID 和运行时类型保留原文。",
	},
	{
		id: "virtual-keys",
		route: "/workspace/governance/virtual-keys",
		owner: "ui/app/workspace/virtual-keys",
		status: "covered",
		retainedEnglish: ["Virtual Key", "API Key", "Token", "MCP"],
		notes: "Virtual Keys 空状态、表格、CSV 导出、表单、详情页、校验消息和 toast 已纳入静态扫描；密钥值、ID 和限制单位保留原文。",
	},
	{
		id: "governance",
		route: "/workspace/governance",
		owner: "ui/app/workspace/governance",
		status: "covered",
		retainedEnglish: ["Team", "Customer", "Virtual Key"],
		notes: "Governance Teams/Customers 页面、表格、空状态、sheet 和加载错误 toast 已纳入静态扫描；实体名称和动态数据保留原文。",
	},
	{
		id: "config-client-settings",
		route: "/workspace/config/client-settings",
		owner: "ui/app/workspace/config/views",
		status: "covered",
		retainedEnglish: ["Header", "x-bf-eh-*", "JSON", "API"],
		notes:
			"Config/Settings 各 view 的标题、说明、form label、toast、按钮和 tooltip 已纳入静态扫描；配置 key、header name、env var 和示例值保留英文。",
	},
	{
		id: "oauth-grants",
		route: "/workspace/oauth-grants",
		owner: "ui/app/workspace/oauth-grants",
		status: "covered",
		retainedEnglish: ["OAuth", "Client ID", "Scope"],
		notes: "OAuth Grants 页面、filter bar、table、actions 和 revoke dialog 已纳入静态扫描；OAuth 协议字段和动态 scope 值保留原文。",
	},
	{
		id: "skills-prompts",
		route: "/workspace/skills-repo",
		owner: "ui/app/workspace/skills-repo + ui/components/prompts",
		status: "covered",
		retainedEnglish: ["Skill", "Prompt", "Claude Code", "Codex", "SKILL.md"],
		notes:
			"Skills Repo 和 Prompts 共享体验的列表、详情、表单、文件管理、消息视图、tool call 控件和空状态已纳入静态扫描；客户端产品名、文件名和代码内容保留原文。",
	},
	{
		id: "dev-profiler",
		route: "development-overlay",
		owner: "ui/components/devProfiler.tsx",
		status: "covered",
		retainedEnglish: ["CPU", "GC", "GOMAXPROCS", "goroutine", "pprof"],
		notes: "开发环境浮层静态标签、按钮 title、错误信息和状态标签已纳入静态扫描；函数名、文件路径、stack trace 和运行时指标名称保留英文。",
	},
	{
		id: "shared-components",
		route: "shared-ui",
		owner: "ui/components + ui/components/ui",
		status: "covered",
		retainedEnglish: ["HTTP", "GRPC", "HH", "MM", "AM", "PM", "N/A"],
		notes:
			"NoPermissionView、FormFooter、SearchSelect、SearchableDropdown、MultiSelect、ModelMultiselect、EntityAssociationSelect、CommandDialog、NumberInput、CEL builder 等共享组件已纳入静态扫描；协议名、时间格式和空值标记保留原文。",
	},
] as const satisfies readonly I18nCoverageModule[];