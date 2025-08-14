import { Component, TFile } from "obsidian";
import TeamDocsPlugin from "../../../main";

export interface LinkHandlerOptions {
	onOpenFile?: (path: string) => void;
}

/**
 * Utility component for handling internal links in rendered content
 */
export class LinkHandler extends Component {
	constructor(
		private plugin: TeamDocsPlugin,
		private options: LinkHandlerOptions = {}
	) {
		super();
	}

	/**
	 * Fix internal links in a container element
	 */
	public fixInternalLinks(container: HTMLElement): void {
		this.fixStandardLinks(container);

		this.fixWikiLinks(container);
	}

	/**
	 * Fix standard internal links (a[data-href])
	 */
	private fixStandardLinks(container: HTMLElement): void {
		const links = container.querySelectorAll("a[data-href]");

		links.forEach((link) => {
			const href = link.getAttribute("data-href");
			if (!href) return;

			link.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.openFile(href);
			});

			link.addClass("internal-link");
			link.addClass("is-unresolved");

			const linkText = link.textContent || "";
			if (!linkText.includes("|") && !linkText.includes(" ")) {
				const filename = href.split("/").pop() || href;
				if (linkText !== filename) {
					link.textContent = filename;
				}
			}
		});
	}

	/**
	 * Fix wiki-style links [[path|display]]
	 */
	private fixWikiLinks(container: HTMLElement): void {
		const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
		const textNodes = this.getTextNodes(container);

		textNodes.forEach((node) => {
			if (!node.textContent) return;

			const text = node.textContent;
			if (!wikiLinkRegex.test(text)) return;

			wikiLinkRegex.lastIndex = 0;

			let lastIndex = 0;
			let match;
			const fragment = document.createDocumentFragment();

			while ((match = wikiLinkRegex.exec(text)) !== null) {
				if (match.index > lastIndex) {
					fragment.appendChild(
						document.createTextNode(text.substring(lastIndex, match.index))
					);
				}

				const path = match[1];
				const displayName = match[2] || path.split("/").pop() || path;

				const link = document.createElement("a");
				link.textContent = displayName;
				link.classList.add("internal-link");
				link.classList.add("is-unresolved");
				link.dataset.href = path;

				link.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.openFile(path);
				};

				fragment.appendChild(link);
				lastIndex = wikiLinkRegex.lastIndex;
			}

			if (lastIndex < text.length) {
				fragment.appendChild(
					document.createTextNode(text.substring(lastIndex))
				);
			}

			if (node.parentNode) {
				node.parentNode.replaceChild(fragment, node);
			}
		});
	}

	/**
	 * Get all text nodes in a container
	 */
	private getTextNodes(container: HTMLElement): Text[] {
		const textNodes: Text[] = [];
		const walker = document.createTreeWalker(
			container,
			NodeFilter.SHOW_TEXT,
			null
		);

		let node;
		while ((node = walker.nextNode())) {
			textNodes.push(node as Text);
		}

		return textNodes;
	}

	/**
	 * Open a file by path
	 */
	private openFile(path: string): void {
		if (this.options.onOpenFile) {
			this.options.onOpenFile(path);
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			this.plugin.app.workspace.getLeaf().openFile(file);
		} else {
			console.warn("[LinkHandler] File not found:", path);
		}
	}

	/**
	 * Create a clickable internal link element
	 */
	public createInternalLink(
		path: string,
		displayName?: string
	): HTMLAnchorElement {
		const link = document.createElement("a");
		link.textContent = displayName || path.split("/").pop() || path;
		link.classList.add("internal-link");
		link.classList.add("is-unresolved");
		link.dataset.href = path;

		link.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openFile(path);
		};

		return link;
	}

	/**
	 * Extract all internal links from text content
	 */
	public extractLinks(
		text: string
	): Array<{ path: string; displayName?: string }> {
		const links: Array<{ path: string; displayName?: string }> = [];
		const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;

		let match;
		while ((match = wikiLinkRegex.exec(text)) !== null) {
			links.push({
				path: match[1],
				displayName: match[2],
			});
		}

		return links;
	}
}
