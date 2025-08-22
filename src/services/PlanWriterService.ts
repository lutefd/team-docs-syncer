import type TeamDocsPlugin from "../../main";
import { ContextStorage } from "./ContextStorageService";

export class PlanWriter {
	private queue: Array<{ sessionId: string; text: string }> = [];
	private flushing = false;
	private storage: ContextStorage;

	constructor(private plugin: TeamDocsPlugin) {
		this.storage = new ContextStorage(plugin);
	}

	append(sessionId: string, text: string) {
		this.queue.push({ sessionId, text });
		void this.flush();
	}

	private async flush() {
		if (this.flushing) return;
		this.flushing = true;
		try {
			while (this.queue.length > 0) {
				const item = this.queue.shift()!;
				await this.storage.appendScratchpad(item.sessionId, item.text);
			}
		} catch (e) {
			console.warn("PlanWriter flush error:", e);
		} finally {
			this.flushing = false;
		}
	}
}
