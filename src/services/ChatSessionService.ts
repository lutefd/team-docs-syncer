import type { ModelMessage } from "ai";
import type TeamDocsPlugin from "../../main";
import { ContextStorage } from "./ContextStorageService";

export interface ChatSession {
	id: string;
	title: string;
	messages: ModelMessage[];
	pinnedPaths: Set<string>;
	createdAt: number;
}

export class ChatSessionService {
	private sessions: ChatSession[] = [];
	private activeId: string | null = null;
	private storage: ContextStorage;

	constructor(plugin: TeamDocsPlugin) {
		this.storage = new ContextStorage(plugin);
		const first = this.createSession();
		this.activeId = first.id;
	}

	list(): ChatSession[] {
		return this.sessions;
	}

	getActive(): ChatSession | null {
		const active = this.sessions.find((s) => s.id === this.activeId);
		if (active) return active;

		if (this.sessions.length === 0 || !this.activeId) {
			return this.createSession();
		}

		return null;
	}

	setActive(id: string): void {
		if (this.sessions.some((s) => s.id === id)) this.activeId = id;
	}

	createSession(title?: string): ChatSession {
		const s: ChatSession = {
			id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			title: title || "New Chat",
			messages: [],
			pinnedPaths: new Set<string>(),
			createdAt: Date.now(),
		};
		this.sessions.unshift(s);
		this.activeId = s.id;
		void this.storage.ensureScratchpadTemplate(s.id);
		return s;
	}

	rename(id: string, title: string) {
		const s = this.sessions.find((x) => x.id === id);
		if (s) s.title = title;
	}

	remove(id: string) {
		const idx = this.sessions.findIndex((x) => x.id === id);
		if (idx >= 0) {
			void this.storage.deleteSessionNotes(id);
			this.sessions.splice(idx, 1);
			if (this.activeId === id) {
				this.activeId = this.sessions[0]?.id || null;
			}
		}
	}

	pin(path: string): void {
		const s = this.getActive();
		if (!s) return;
		s.pinnedPaths.add(path);
	}

	unpin(path: string): void {
		const s = this.getActive();
		if (!s) return;
		s.pinnedPaths.delete(path);
	}

	getPinned(): string[] {
		const s = this.getActive();
		return s ? Array.from(s.pinnedPaths) : [];
	}

	/**
	 * Replace older non-system messages with a single system summary message,
	 * keeping the most recent N turns intact.
	 */
	compactHistory(
		sessionId: string,
		summary: string,
		keepLastN: number = 20
	): void {
		const s = this.sessions.find((x) => x.id === sessionId);
		if (!s) return;
		if (!Array.isArray(s.messages) || s.messages.length === 0) return;

		const msgs = s.messages;
		const recent = msgs.slice(-keepLastN);
		const preservedSystem = msgs.filter((m) => m.role === "system");
		const nonSystemRecent = recent.filter((m) => m.role !== "system");

		const isAutoSummary = (m: ModelMessage) =>
			typeof m.content === "string" &&
			m.content.startsWith("Conversation summary so far:");
		const systemWithoutAutoSummary = preservedSystem.filter(
			(m) => !isAutoSummary(m as any)
		);

		const summaryMsg = {
			role: "system",
			content: `Conversation summary so far:\n${summary}`,
		} as ModelMessage;

		const uniqueSystem = Array.from(
			new Map(
				systemWithoutAutoSummary.map((m) => [m.content as string, m])
			).values()
		) as ModelMessage[];

		s.messages = [...uniqueSystem, summaryMsg, ...nonSystemRecent];
	}
}
