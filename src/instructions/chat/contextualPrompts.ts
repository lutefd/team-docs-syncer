export interface ContextualPromptOptions {
	candidates: Array<{ path: string; title: string; frontmatter?: any }>;
	pinnedFiles: string[];
}

export function createContextualPrompt({
	candidates,
	pinnedFiles,
}: ContextualPromptOptions): string {
	const contextBlurb = candidates
		.map(
			(m, i) =>
				`#${i + 1} ${m.path}\nTitle: ${m.title}\nFrontmatter: ${JSON.stringify(
					m.frontmatter || {}
				)}`
		)
		.join("\n\n");

	return `Relevant files:\n\n${contextBlurb}\n\nPinned:\n${pinnedFiles
		.map((p, i) => `#${i + 1} ${p}`)
		.join("\n")}`;
}

export function createEditContextPrompt(filePath: string): string {
	return `Edit ${filePath}: Apply requested changes, keeping structure/style intact unless specified.`;
}
