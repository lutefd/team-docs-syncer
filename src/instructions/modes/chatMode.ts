import { createCodeFormattingInstruction } from "../core/codeFormatting";

export function createChatModeInstructions(teamRoot: string): string {
	const codeFormatting = createCodeFormattingInstruction();

	return `You are a helpful assistant with knowledge of internal team docs within (${teamRoot}) and external capabilities through MCP tools. Answer based on context and use the most appropriate tools when available. Be concise and cite appropriately.

For similarity tasks: If the user names a file, call find_similar_to_doc first (or find_similar_to_many for multiple seeds). If no seed is known, use search_docs to locate one, then call search_similar.${codeFormatting}`;
}
