import { generateText, type LanguageModel } from "ai";
import type TeamDocsPlugin from "../../main";
import { ContextStorage } from "./ContextStorageService";
import { shouldExtractMemories } from "src/utils/TaskHeuristics";

export class MemoryService {
	private storage: ContextStorage;
	constructor(private plugin: TeamDocsPlugin) {
		this.storage = new ContextStorage(plugin);
	}

	async extractAndStoreIfUseful(
		sessionId: string,
		lastUserText: string,
		assistantText: string,
		model: LanguageModel,
		proposalsCount: number,
		creationsCount: number
	): Promise<void> {
		try {
			if (
				!shouldExtractMemories(
					lastUserText || "",
					assistantText || "",
					proposalsCount,
					creationsCount
				)
			)
				return;
			const convoSnippet = `${
				lastUserText || ""
			}\n\nAssistant: ${assistantText.slice(0, 1000)}`;
			const memGen = await generateText({
				model,
				temperature: 0.1,
				messages: [
					{
						role: "system",
						content:
							"From the conversation, propose up to 3 durable memories as JSON array with fields: content, type in ['fact','preference','entity'], tags (array of strings). Only output JSON. Save only long-lived facts, preferences, entities, or decisions useful later. Ignore transient tool outputs.",
					},
					{ role: "user", content: convoSnippet },
				],
			});
			let items: Array<{ content: string; type?: string; tags?: string[] }> =
				[];
			try {
				const parsed = JSON.parse(memGen.text || "[]");
				if (Array.isArray(parsed)) items = parsed;
			} catch {}
			if (items.length) {
				const existing = await this.storage.readMemories(sessionId);
				for (const it of items) {
					const content = String(it.content || "").trim();
					if (!content) continue;
					if (existing.some((e: any) => e.content === content)) continue;
					existing.push({
						id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
						type: (it.type as any) || "fact",
						content,
						tags: Array.isArray(it.tags) ? it.tags : [],
						createdAt: Date.now(),
					});
				}
				await this.storage.writeMemories(sessionId, existing);
			}
		} catch (e) {
			console.warn("MemoryService.extractAndStoreIfUseful error:", e);
		}
	}
}
