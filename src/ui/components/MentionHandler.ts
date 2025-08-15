import { Component } from "obsidian";
import TeamDocsPlugin from "../../../main";

export interface MentionHandlerOptions {
	onMentionSelect?: (item: string) => void;
}

/**
 * Component responsible for handling mention functionality in chat input
 */
export class MentionHandler extends Component {
	private mentionMenuEl?: HTMLElement;
	private mentionActive = false;
	private mentionItems: string[] = [];
	private mentionIndex = 0;
	private inputEl?: HTMLTextAreaElement | HTMLDivElement;

	constructor(
		private plugin: TeamDocsPlugin,
		private options: MentionHandlerOptions = {}
	) {
		super();
	}

	/**
	 * Initialize mention handler with input element
	 */
	initialize(
		inputEl: HTMLTextAreaElement | HTMLDivElement,
		containerEl: HTMLElement
	): void {
		this.inputEl = inputEl;

		inputEl.addEventListener("keydown", (e) =>
			this.handleKeyDown(e as KeyboardEvent)
		);
		inputEl.addEventListener("input", () => this.handleInput());
	}

	/**
	 * Get text content from input element
	 */
	private getInputValue(): string {
		if (!this.inputEl) return "";

		if (this.inputEl instanceof HTMLTextAreaElement) {
			return this.inputEl.value;
		} else {
			return this.inputEl.textContent || "";
		}
	}

	/**
	 * Get cursor position in input element
	 */
	private getCursorPosition(): number {
		if (!this.inputEl) return 0;

		if (this.inputEl instanceof HTMLTextAreaElement) {
			return this.inputEl.selectionStart || 0;
		} else {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const preCaretRange = range.cloneRange();
				preCaretRange.selectNodeContents(this.inputEl);
				preCaretRange.setEnd(range.endContainer, range.endOffset);
				return preCaretRange.toString().length;
			}
			return 0;
		}
	}

	/**
	 * Set cursor position and insert text
	 */
	private insertTextAtCursor(text: string, replaceLength: number = 0): void {
		if (!this.inputEl) return;

		if (this.inputEl instanceof HTMLTextAreaElement) {
			const value = this.inputEl.value;
			const cursorPos = this.inputEl.selectionStart || 0;
			const start = cursorPos - replaceLength;
			const newValue =
				value.substring(0, start) + text + value.substring(cursorPos);
			this.inputEl.value = newValue;
			const newCursorPos = start + text.length;
			this.inputEl.setSelectionRange(newCursorPos, newCursorPos);
		} else {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);

				if (replaceLength > 0) {
					const startOffset = Math.max(0, range.startOffset - replaceLength);
					range.setStart(range.startContainer, startOffset);
				}

				range.deleteContents();
				const textNode = document.createTextNode(text);
				range.insertNode(textNode);

				range.setStartAfter(textNode);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
	}

	/**
	 * Handle keydown events for mention navigation
	 */
	private handleKeyDown(e: KeyboardEvent): boolean {
		if (!this.mentionActive) return false;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				this.mentionIndex = Math.min(
					this.mentionIndex + 1,
					this.mentionItems.length - 1
				);
				this.renderMentionMenu();
				return true;

			case "ArrowUp":
				e.preventDefault();
				this.mentionIndex = Math.max(this.mentionIndex - 1, 0);
				this.renderMentionMenu();
				return true;

			case "Enter":
				e.preventDefault();
				this.applyMentionSelection();
				return true;

			case "Escape":
				this.hideMentionMenu();
				return true;

			default:
				return false;
		}
	}

	/**
	 * Handle input changes to detect mention triggers
	 */
	private handleInput(): void {
		if (!this.inputEl) return;

		const value = this.getInputValue();
		const cursorPos = this.getCursorPosition();

		const textBeforeCursor = value.substring(0, cursorPos);
		const lastAtIndex = textBeforeCursor.lastIndexOf("@");

		if (lastAtIndex === -1) {
			this.hideMentionMenu();
			return;
		}

		const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
		if (textAfterAt.includes(" ")) {
			this.hideMentionMenu();
			return;
		}

		const query = textAfterAt.toLowerCase();
		this.showMentionMenu(query);
	}

	/**
	 * Show mention menu with filtered items
	 */
	private showMentionMenu(query: string): void {
		if (!this.inputEl) return;

		const files = this.plugin.app.vault.getMarkdownFiles();

		this.mentionItems = files
			.map((file) => file.path)
			.filter((path) => path.toLowerCase().includes(query))
			.slice(0, 10);

		if (this.mentionItems.length === 0) {
			this.hideMentionMenu();
			return;
		}

		this.mentionActive = true;
		this.mentionIndex = 0;
		this.renderMentionMenu();
	}

	/**
	 * Render the mention menu
	 */
	private renderMentionMenu(): void {
		if (!this.inputEl) return;

		if (this.mentionMenuEl) {
			this.mentionMenuEl.remove();
		}

		this.mentionMenuEl = document.createElement("div");
		this.mentionMenuEl.className = "mention-menu";

		const inputRect = this.inputEl.getBoundingClientRect();
		this.mentionMenuEl.style.position = "fixed";
		this.mentionMenuEl.style.bottom = `${
			window.innerHeight - inputRect.top + 5
		}px`;
		this.mentionMenuEl.style.left = `${inputRect.left}px`;
		this.mentionMenuEl.style.maxWidth = `${inputRect.width}px`;

		this.mentionItems.forEach((item, index) => {
			const menuItem = this.mentionMenuEl!.createDiv({
				cls: `mention-item ${index === this.mentionIndex ? "is-selected" : ""}`,
			});

			const filename = item.split("/").pop() || item;
			menuItem.textContent = filename;
			menuItem.title = item;

			menuItem.addEventListener("click", () => {
				this.mentionIndex = index;
				this.applyMentionSelection();
			});
		});

		document.body.appendChild(this.mentionMenuEl);
	}

	/**
	 * Apply the selected mention
	 */
	private applyMentionSelection(): void {
		if (!this.inputEl || !this.mentionActive || this.mentionItems.length === 0)
			return;

		const selectedItem = this.mentionItems[this.mentionIndex];
		const value = this.getInputValue();
		const cursorPos = this.getCursorPosition();

		const textBeforeCursor = value.substring(0, cursorPos);
		const lastAtIndex = textBeforeCursor.lastIndexOf("@");

		if (lastAtIndex !== -1) {
			const filename = selectedItem.split("/").pop() || selectedItem;
			const mentionText = `[[${selectedItem}|${filename}]]`;
			const replaceLength = cursorPos - lastAtIndex;

			this.insertTextAtCursor(mentionText, replaceLength);
		}

		this.hideMentionMenu();

		if (this.options.onMentionSelect) {
			this.options.onMentionSelect(selectedItem);
		}
	}

	/**
	 * Hide the mention menu
	 */
	private hideMentionMenu(): void {
		this.mentionActive = false;
		this.mentionItems = [];
		this.mentionIndex = 0;

		if (this.mentionMenuEl) {
			this.mentionMenuEl.remove();
			this.mentionMenuEl = undefined;
		}
	}

	/**
	 * Check if mention menu is currently active
	 */
	public isActive(): boolean {
		return this.mentionActive;
	}

	/**
	 * Force hide mention menu (useful for cleanup)
	 */
	public hide(): void {
		this.hideMentionMenu();
	}

	/**
	 * Cleanup when component is destroyed
	 */
	onunload(): void {
		this.hideMentionMenu();
	}
}
