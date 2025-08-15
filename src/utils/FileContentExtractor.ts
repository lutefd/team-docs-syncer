import { App, TFile } from "obsidian";

/**
 * Utility for extracting file content from wiki-style links
 */
export class FileContentExtractor {
	constructor(private app: App) {}

	/**
	 * Extract wiki-style links from text
	 * Matches patterns like [[path/file.md]] or [[path/file.md|display name]]
	 */
	extractWikiLinks(
		text: string
	): Array<{ path: string; displayName?: string; fullMatch: string }> {
		const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
		const links: Array<{
			path: string;
			displayName?: string;
			fullMatch: string;
		}> = [];

		let match;
		while ((match = wikiLinkRegex.exec(text)) !== null) {
			links.push({
				path: match[1].trim(),
				displayName: match[2]?.trim(),
				fullMatch: match[0],
			});
		}

		return links;
	}

	/**
	 * Get file content by path
	 */
	async getFileContent(path: string): Promise<string | null> {
		try {
			console.log(`[FileContentExtractor] Attempting to read file: ${path}`);

			const file = this.app.vault.getAbstractFileByPath(path);

			if (file instanceof TFile) {
				console.log(
					`[FileContentExtractor] Found file by exact path: ${file.path}`
				);
				return await this.app.vault.read(file);
			}

			const files = this.app.vault.getMarkdownFiles();
			console.log(
				`[FileContentExtractor] Searching among ${files.length} markdown files`
			);

			const fileByName = files.find((f) => {
				const matches = [
					f.path === path,
					f.name === path,
					f.basename === path.replace(/\.md$/, ""),
					f.path.endsWith("/" + path),
					f.path.includes(path),
					path.includes(f.name),
					path.endsWith(f.name),
				];

				if (matches.some((m) => m)) {
					console.log(
						`[FileContentExtractor] Found potential match: ${f.path} for ${path}`
					);
				}

				return matches.some((m) => m);
			});

			if (fileByName) {
				console.log(`[FileContentExtractor] Using file: ${fileByName.path}`);
				return await this.app.vault.read(fileByName);
			}

			console.log(`[FileContentExtractor] No file found for path: ${path}`);
			return null;
		} catch (error) {
			console.error(
				`[FileContentExtractor] Error reading file ${path}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Process text and attach file content for wiki links
	 * Returns the original text with <attachedcontent> tags appended
	 */
	async processTextWithAttachments(text: string): Promise<string> {
		const links = this.extractWikiLinks(text);

		if (links.length === 0) {
			return text;
		}

		const attachments: string[] = [];

		for (const link of links) {
			console.log(
				`[FileContentExtractor] Processing link: ${link.path} (display: ${link.displayName})`
			);
			const content = await this.getFileContent(link.path);
			if (content) {
				const fileName =
					link.displayName || link.path.split("/").pop() || link.path;
				console.log(
					`[FileContentExtractor] Successfully attached content for: ${fileName}`
				);
				attachments.push(`<attachedcontent file="${fileName}" path="${link.path}">
${content}
</attachedcontent>`);
			} else {
				console.log(
					`[FileContentExtractor] No content found for: ${link.path}`
				);
			}
		}

		if (attachments.length === 0) {
			return text;
		}

		return text + "\n\n" + attachments.join("\n\n");
	}
}
