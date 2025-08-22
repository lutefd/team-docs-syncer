export function createWorkflowInstructions(teamRoot: string): string {
	return `\n\nIMPORTANT WORKFLOW (PRIORITIZE MCP TOOLS):
- FIRST: Evaluate if MCP tools provide better functionality for the task (external files, web content, broader capabilities)
- IF MCP tools are better suited: Use MCP tools instead of internal Obsidian tools
- IF working with internal team docs: Use Obsidian tools (list_docs, search_docs, read_doc, etc.)
- For external searches, file operations, web content, or broader functionality: PREFER MCP tools
- ALWAYS start by using appropriate tools to browse/search (MCP tools for external, Obsidian tools for team docs)
- ALWAYS read content before answering questions about specific files or making edits
- If results lack context, use appropriate tools for details or connections
- For edits: read first, then use appropriate edit tool with COMPLETE updated content
- For new files: use appropriate create tool with COMPLETE content
- NEVER guess file contents—always read first
- Wrap your thinking in <think> tags for reasoning steps, then provide your final answer in <finalAnswer> tags
- After tools, provide ONLY a brief summary—reference files appropriately
- Do NOT include file content in responses; tools handle operations

PLANNING AND MEMORIES (INTERNAL SCRATCHPAD TOOLS):
- Routine (do this every time the task seems complex or too abstract):
  1) Before first tool call, draft a brief plan (≤5 steps) via planning_write.
  2) After each tool batch, update progress + next step via planning_write.
  3) On completion, append result + follow-ups via planning_write.
- Use planning_update_section to directly edit sections (Goals, Plan, Progress, Next, Decisions).
- Use planning_replace if you need to tidy/reshape the plan into a clean checklist.
- Use memories_add for durable items only (see rules below). Use memories_list to recall before planning.
- These are INTERNAL notes; do not echo raw scratchpad content unless asked.

MEMORY CAPTURE RULES (WHEN TO CALL memories_add):
- Save: persistent facts, user preferences, long-lived entities (IDs, names, URLs), decisions that affect future work.
- Do NOT save: transient tool output, ephemeral paths, step-by-step noise, or anything already in files.
- Format: concise one-liner; choose type = fact | preference | entity; add tags when helpful.

OBSIDIAN BASES/INDEXES (.base files):
- To create a .base file, FIRST use the 'search_base_def' tool to get the schema, THEN use 'create_base' with a .base path and full YAML content.
- YAML must define filters, formulas, properties, and views (see schema).
- Bases can be embedded in notes using ![[path/to/file.base]] or ![[path/to/file.base#ViewName]], or via a 'base' code block with YAML. Look at the schema via the 'search_base_def' tool to understand the structure.

SIMILARITY SEARCH (TAGS + CONTENT) FOR INTERNAL DOCS:
- First off use 'search_base_def' to get the schema.
- If you already know the seed document: use 'find_similar_to_doc' with a path or wikilink. It will extract tags/title, search by tags + content, and return ranked results plus a ready Base YAML to render "Related" items.
- If you don't know the exact file:
  1) Use 'search_docs' to find the seed.
  2) Extract tags from the result's frontmatter (e.g., frontmatter.tags).
  3) Call 'search_similar' with { query: seed.title or brief summary, tags: extractedTags, k }.
- Rendering results:
  - Use the returned base.yaml to embed via a 'base' code block in a note
- Filtering rule: Avoid restrictive 'where' clauses or path equality filters (e.g., file.path == ...) that limit results by default. Prefer broad tag-based filters in Base YAML unless the user explicitly asks to narrow.
- Scope: These Obsidian tools operate within the configured AI scope (team-docs or vault-wide). Prefer MCP tools for external/web/code data.
`;
}

export function createNonToolWorkflowInstructions(): string {
	return `\n\nIMPORTANT: Answer based on provided context and attached files. You do NOT have access to tools in this mode. Be helpful within the appropriate scope.`;
}
