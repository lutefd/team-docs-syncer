import { Component, TFile, MarkdownRenderer } from "obsidian";
import TeamDocsPlugin from "../../main";
import { LinkHandler } from "../ui/components/LinkHandler";

export interface SessionManagerOptions {
	onSessionChange?: (sessionId: string) => void;
	onPinsChange?: (pins: string[]) => void;
}

/**
 * Component responsible for managing chat session UI elements
 */
export class SessionManager extends Component {
	private linkHandler: LinkHandler;

	constructor(
		private plugin: TeamDocsPlugin,
		private options: SessionManagerOptions = {}
	) {
		super();
		this.linkHandler = new LinkHandler(plugin);
	}

	/**
	 * Render pinned files display
	 */
	public renderPins(pinsEl: HTMLElement): void {
		if (!pinsEl) return;

		pinsEl.empty();
		const session = this.plugin.chatSessionService.getActive();
		const pins = session ? Array.from(session.pinnedPaths) : [];

		for (const path of pins) {
			const chip = pinsEl.createDiv({ cls: "pin-chip" });

			const filename = path.split("/").pop() || path;
			const link = chip.createEl("a", {
				text: filename,
				cls: "pin-label internal-link",
			});

			link.onclick = (e) => {
				e.preventDefault();
				this.openFile(path);
			};

			const removeBtn = chip.createEl("button", {
				text: "×",
				cls: "pin-remove",
				attr: { "aria-label": `Remove ${path} from pins` },
			});

			removeBtn.onclick = () => {
				this.plugin.chatSessionService.unpin(path);
				this.renderPins(pinsEl);

				if (this.options.onPinsChange) {
					const updatedSession = this.plugin.chatSessionService.getActive();
					const updatedPins = updatedSession
						? Array.from(updatedSession.pinnedPaths)
						: [];
					this.options.onPinsChange(updatedPins);
				}
			};
		}
	}

	/**
	 * Render sources display
	 */
	public renderSources(sourcesEl: HTMLElement, sources: string[]): void {
		if (!sourcesEl) return;

		sourcesEl.empty();

		if (sources.length === 0) return;

		const header = sourcesEl.createDiv({ cls: "sources-header" });
		header.createEl("strong", { text: "Sources:" });

		const sourcesList = sourcesEl.createDiv({ cls: "sources-list" });

		for (const source of sources) {
			const sourceItem = sourcesList.createDiv({ cls: "source-item" });

			const filename = source.split("/").pop() || source;
			const link = sourceItem.createEl("a", {
				text: filename,
				cls: "source-link internal-link",
			});

			link.onclick = (e) => {
				e.preventDefault();
				this.openFile(source);
			};

			const pinBtn = sourceItem.createEl("button", {
				text: "📌",
				cls: "source-pin-btn",
				attr: { "aria-label": `Pin ${source}` },
			});

			pinBtn.onclick = (e) => {
				e.stopPropagation();
				this.plugin.chatSessionService.pin(source);
				this.renderPins(document.querySelector(".chatbot-pins") as HTMLElement);

				if (this.options.onPinsChange) {
					const session = this.plugin.chatSessionService.getActive();
					const pins = session ? Array.from(session.pinnedPaths) : [];
					this.options.onPinsChange(pins);
				}
			};
		}
	}

	/**
	 * Create mode toggle buttons
	 */
	public createModeToggle(
		container: HTMLElement,
		currentMode: "compose" | "write" | "chat",
		onModeChange: (mode: "compose" | "write" | "chat") => void
	): { composeBtn: HTMLButtonElement; writeBtn: HTMLButtonElement; chatBtn: HTMLButtonElement } {
		const modeWrap = container.createDiv({ cls: "chatbot-mode" });

		const composeBtn = modeWrap.createEl("button", {
			text: "Compose",
			cls: "chatbot-btn",
		});

		const writeBtn = modeWrap.createEl("button", {
			text: "Write",
			cls: "chatbot-btn",
		});

		const chatBtn = modeWrap.createEl("button", {
			text: "Chat",
			cls: "chatbot-btn",
		});

		const setMode = (mode: "compose" | "write" | "chat") => {
			composeBtn.toggleClass("is-active", mode === "compose");
			writeBtn.toggleClass("is-active", mode === "write");
			chatBtn.toggleClass("is-active", mode === "chat");
			onModeChange(mode);
		};

		composeBtn.onclick = () => setMode("compose");
		writeBtn.onclick = () => setMode("write");
		chatBtn.onclick = () => setMode("chat");

		setMode(currentMode);

		return { composeBtn, writeBtn, chatBtn };
	}

	/**
	 * Create sessions button
	 */
	public createSessionsButton(
		container: HTMLElement,
		onSessionsClick: () => void
	): HTMLButtonElement {
		const sessionsBtn = container.createEl("button", {
			text: "Sessions",
			cls: "chatbot-btn",
		});

		sessionsBtn.onclick = onSessionsClick;

		return sessionsBtn;
	}

	/**
	 * Get current session info
	 */
	public getCurrentSessionInfo(): {
		id: string;
		title: string;
		messageCount: number;
		pinnedCount: number;
	} | null {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return null;

		return {
			id: session.id,
			title: session.title,
			messageCount: session.messages.length,
			pinnedCount: session.pinnedPaths.size,
		};
	}

	/**
	 * Open a file by path
	 */
	private openFile(path: string): void {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			this.plugin.app.workspace.getLeaf().openFile(file);
		}
	}
}
