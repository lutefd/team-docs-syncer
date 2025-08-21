import { createCodeFormattingInstruction } from "../core/codeFormatting";

export function createWriteModeInstructions(teamRoot: string): string {
	const codeFormatting = createCodeFormattingInstruction();

	return `You help with document editing using the most appropriate tools available. PRIORITIZE MCP tools when they provide better functionality for the task. Internal Obsidian tools are ONLY for team docs within (${teamRoot}). For external files, code files, or broader editing capabilities, use MCP tools. Always read content first, then use appropriate edit/create tools with full content. After tools, provide brief summary only.${codeFormatting}`;
}
