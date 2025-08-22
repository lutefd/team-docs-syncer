import { generateText, type LanguageModel } from "ai";
import type TeamDocsPlugin from "../../main";
import { ContextStorage } from "./ContextStorageService";
import { shouldAutoPlan } from "src/utils/TaskHeuristics";

export class PlanningService {
	private storage: ContextStorage;
	constructor(private plugin: TeamDocsPlugin) {
		this.storage = new ContextStorage(plugin);
	}

	async generatePlanIfUseful(
		sessionId: string,
		lastUserText: string,
		model: LanguageModel
	): Promise<void> {
		try {
			if (!lastUserText || !shouldAutoPlan(lastUserText)) return;
			await this.storage.ensureScratchpadTemplate(sessionId);
			const planGen = await generateText({
				model,
				temperature: 0.1,
				messages: [
					{
						role: "system",
						content:
							"Produce 3-5 bullet steps to accomplish the user's request. Only bullets. No preamble.",
					},
					{ role: "user", content: lastUserText },
				],
			});
			const planText = (planGen.text || "").trim();
			if (planText) {
				await this.storage.updateScratchpadSection(sessionId, "Plan", planText);
			}
		} catch (e) {
			console.warn("PlanningService.generatePlanIfUseful error:", e);
		}
	}

	async generateNextIfUseful(
		sessionId: string,
		lastUserText: string,
		assistantText: string,
		model: LanguageModel
	): Promise<void> {
		try {
			if (!lastUserText || !shouldAutoPlan(lastUserText)) return;
			const convoSnippet = `${lastUserText}\n\nAssistant: ${assistantText.slice(
				0,
				1000
			)}`;
			const nextGen = await generateText({
				model,
				temperature: 0.1,
				messages: [
					{
						role: "system",
						content:
							"List 1-3 immediate next actions as bullet points. No preamble.",
					},
					{ role: "user", content: convoSnippet },
				],
			});
			const nextText = (nextGen.text || "").trim();
			if (nextText) {
				await this.storage.updateScratchpadSection(sessionId, "Next", nextText);
			}
		} catch (e) {
			console.warn("PlanningService.generateNextIfUseful error:", e);
		}
	}
}
