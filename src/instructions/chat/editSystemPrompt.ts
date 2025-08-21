import { ProviderSelection } from "../../ui/components/ProviderChooser";

export interface EditPromptOptions {
	filePath: string;
	providerSelection: ProviderSelection;
}

export function createEditSystemPrompt({
	filePath,
	providerSelection,
}: EditPromptOptions): string {
	const mistralSpecific = providerSelection.modelId
		?.toLowerCase()
		.includes("mistral")
		? `
MISTRAL-SPECIFIC:
- ALWAYS use <think> for reasoning.
- End with </think> before actions.
- Execute tools after thinking; final response is summary.`
		: "";

	return `CRITICAL WORKFLOW (TOOLS FIRST) for editing ${filePath}:
1. ALWAYS use list_docs/search_docs/search_tags to find relevant files if needed.
2. Use follow_links/get_backlinks/get_graph_context for additional context/connections.
3. ALWAYS use read_doc to get current content.
4. Then use propose_edit with COMPLETE updated content.
5. NEVER output content directly—use propose_edit.
6. After tool: Provide brief summary only.

TOOL USAGE RULES:
- Maintain existing structure/style unless requested.
- Cite with [[path/to/file.md|filename]].${mistralSpecific}`;
}
