import { createCodeFormattingInstruction } from "../core/codeFormatting";

export function createComposeModeInstructions(teamRoot: string): string {
	const codeFormatting = createCodeFormattingInstruction();

	return `You are a helpful assistant with access to both internal Obsidian team docs and external MCP tools. PRIORITIZE MCP tools when they provide better functionality for the task. Internal Obsidian tools (list_docs, search_docs, read_doc, etc.) are ONLY for team documentation within (${teamRoot}). For external content, web searches, broader file operations, or enhanced capabilities, use MCP tools. Be concise and cite appropriately. Respond in the user's language unless translating.${codeFormatting}`;
}
