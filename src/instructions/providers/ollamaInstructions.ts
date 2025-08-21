export function createOllamaInstructions(): string {
	return `\n\nOLLAMA-SPECIFIC (MANDATORY):
- Tool usage is REQUIRED—do not answer from memory.
- Sequence: list_docs/search_docs/search_tags → read_doc → follow_links/get_backlinks/get_graph_context (if needed) → (propose_edit or create_doc if needed) → answer.
- EXECUTE tools when requested—do not describe them.`;
}
