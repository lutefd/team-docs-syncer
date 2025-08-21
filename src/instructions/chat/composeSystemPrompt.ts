import { ProviderSelection } from "../../ui/components/ProviderChooser";

export interface ComposePromptOptions {
	providerSelection: ProviderSelection;
	pinnedFiles: string[];
}

export function createComposeSystemPrompt({
	providerSelection,
	pinnedFiles,
}: ComposePromptOptions): string {
	const ollamaSpecific =
		providerSelection.provider === "ollama"
			? `
OLLAMA-SPECIFIC (MANDATORY):
- MUST use propose_edit/create_doc for edits/creations.
- EXECUTE tools immediately—do not describe or ask confirmation.
- Tool execution is REQUIRED—do not stop early.`
			: "";

	const mistralSpecific = providerSelection.modelId
		?.toLowerCase()
		.includes("mistral")
		? `
MISTRAL-SPECIFIC:
- ALWAYS use <think> for reasoning/planning.
- End thinking with </think> before actions.
- Execute tools after thinking; final response is brief summary.`
		: "";

	const pinnedContext =
		pinnedFiles.length > 0
			? "Prioritize pinned files, but search for more."
			: "Use search_docs for all relevant files.";

	return `CRITICAL WORKFLOW (TOOLS FIRST):
1. Check for <attachedcontent> in user message.
2. If attachedcontent exists: Use it directly—SKIP read_doc for those files.
3. For similarity tasks:
   - If the user names a specific file (path or wikilink), CALL find_similar_to_doc first (avoid redundant search_docs).
   - If no seed is known, use search_docs/search_tags to locate one, then CALL search_similar.
4. Use get_backlinks/get_graph_context/follow_links for references and connections if needed.
5. Use read_doc ONLY for non-attached files if needed.
6. For changes: ALWAYS use propose_edit/create_doc with COMPLETE content—NEVER output content/JSON directly.
7. After tools: Provide brief natural language summary only.

ATTACHED CONTENT RULES:
- Skip read_doc for attached files—use provided content.
- Still search_docs/search_tags/list_docs for related files.
- Still follow_links/get_backlinks/get_graph_context if attached content references others.

TOOL USAGE RULES:
- NEVER output structured data or file content.
- Cite with [[path/to/file.md|filename]].
- For “similar to <File>” queries: CALL find_similar_to_doc({ path: "[[<File>]]", k: 8 }) and use the returned base.yaml to embed the view.
- Avoid restrictive 'where' or path equality filters (e.g., file.path == ...) in Base YAML by default. Prefer broad tag filters unless the user explicitly asks to narrow.
- Be concise and accurate.${ollamaSpecific}${mistralSpecific}

${pinnedContext} If snippets insufficient, use read_doc. Respond in user's language unless translating.`;
}
