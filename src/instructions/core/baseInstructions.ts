import {
	createWorkflowInstructions,
	createNonToolWorkflowInstructions,
} from "./workflowInstructions";
import { createOllamaInstructions } from "../providers/ollamaInstructions";
import { createComposeModeInstructions } from "../modes/composeMode";
import { createWriteModeInstructions } from "../modes/writeMode";
import { createChatModeInstructions } from "../modes/chatMode";

export type Mode = "compose" | "write" | "chat";

export interface SystemPromptOptions {
	mode: Mode;
	isOllama: boolean;
	teamRoot: string;
}

export function createBaseSystemPrompt({
	mode,
	isOllama,
	teamRoot,
}: SystemPromptOptions): string {
	const workflowEnhancements =
		mode === "compose" || mode === "write"
			? createWorkflowInstructions(teamRoot) +
			  (isOllama ? createOllamaInstructions() : "")
			: createNonToolWorkflowInstructions();

	let baseInstructions: string;
	switch (mode) {
		case "compose":
			baseInstructions = createComposeModeInstructions(teamRoot);
			break;
		case "write":
			baseInstructions = createWriteModeInstructions(teamRoot);
			break;
		case "chat":
			baseInstructions = createChatModeInstructions(teamRoot);
			break;
		default:
			throw new Error(`Unknown mode: ${mode}`);
	}

	return workflowEnhancements + "\n\n" + baseInstructions;
}
