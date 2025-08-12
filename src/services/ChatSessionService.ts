import type { ModelMessage } from "ai";

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

	constructor() {
		const first = this.createSession();
		this.activeId = first.id;
	}

	list(): ChatSession[] {
		return this.sessions;
	}

	getActive(): ChatSession | null {
		return this.sessions.find((s) => s.id === this.activeId) || null;
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
		return s;
	}

	rename(id: string, title: string) {
		const s = this.sessions.find((x) => x.id === id);
		if (s) s.title = title;
	}

	remove(id: string) {
		const idx = this.sessions.findIndex((x) => x.id === id);
		if (idx >= 0) {
			this.sessions.splice(idx, 1);
			if (this.activeId === id) {
				this.activeId = this.sessions[0]?.id || null;
			}
		}
	}
}
