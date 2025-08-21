import {
	createBaseSystemPrompt,
	type Mode,
	type SystemPromptOptions,
} from "./core/baseInstructions";
import { createMCPInstructions, type MCPToolInfo } from "./mcp/mcpInstructions";
import {
	createComposeSystemPrompt,
	type ComposePromptOptions,
} from "./chat/composeSystemPrompt";
import {
	createEditSystemPrompt,
	type EditPromptOptions,
} from "./chat/editSystemPrompt";
import {
	createContextualPrompt,
	createEditContextPrompt,
	type ContextualPromptOptions,
} from "./chat/contextualPrompts";

export interface InstructionBuilderOptions extends SystemPromptOptions {
	mcpTools?: MCPToolInfo[];
}

export function buildSystemPrompt({
	mode,
	isOllama,
	teamRoot,
	mcpTools,
}: InstructionBuilderOptions): string {
	const basePrompt = createBaseSystemPrompt({ mode, isOllama, teamRoot });
	const mcpInstructions = mcpTools?.length
		? createMCPInstructions(mcpTools)
		: "";

	return basePrompt + mcpInstructions;
}

export function buildComposeSystemPrompt(
	options: ComposePromptOptions
): string {
	return createComposeSystemPrompt(options);
}

export function buildEditSystemPrompt(options: EditPromptOptions): string {
	return createEditSystemPrompt(options);
}

export function buildContextualPrompt(
	options: ContextualPromptOptions
): string {
	return createContextualPrompt(options);
}

export function buildEditContextPrompt(filePath: string): string {
	return createEditContextPrompt(filePath);
}

export type {
	Mode,
	MCPToolInfo,
	ComposePromptOptions,
	EditPromptOptions,
	ContextualPromptOptions,
};
