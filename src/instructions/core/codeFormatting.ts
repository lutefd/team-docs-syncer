export function createCodeFormattingInstruction(): string {
	return `\n\nCODE FORMATTING REQUIREMENT:
- ALWAYS wrap code snippets in fenced code blocks with language specification
- Use format: \`\`\`language-name for proper syntax highlighting
- Examples: \`\`\`typescript, \`\`\`javascript, \`\`\`python, \`\`\`bash, \`\`\`json, etc.
- Also try to identify react components and mark those with \`\`\`tsx or \`\`\`jsx depending on if it has types or not.
- Never output raw code without proper fencing and language tags`;
}
