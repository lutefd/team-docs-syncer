export interface MCPToolInfo {
	clientId: string;
	clientName: string;
	tools: Array<{
		name: string;
		description?: string;
	}>;
}

export function createMCPInstructions(mcpTools: MCPToolInfo[]): string {
	if (!mcpTools.length) {
		return "";
	}

	return `
CRITICAL: Use MCP tools when they provide better functionality than internal Obsidian tools. MCP tools are preferred for:
- External file operations (outside team docs folder)
- Web content and searches
- Code files and broader programming tasks
- Enhanced capabilities beyond basic markdown operations
- Any task where MCP tools offer superior functionality

Internal Obsidian tools should ONLY be used for team documentation within the configured sync folder.`;
}
