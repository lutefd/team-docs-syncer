import type TeamDocsPlugin from "../../main";
import type { ModelMessage } from "ai";
import { generateText } from "ai";
import { AiProviderFactory } from "../factories/AiProviderFactory";
import { AiProvider } from "../types/AiProvider";

export class SummarizerService {
	constructor(private plugin: TeamDocsPlugin) {}

	async summarize(
		messages: ModelMessage[],
		options: {
			provider?: AiProvider;
			modelId?: string;
			targetTokens?: number;
		}
	): Promise<string | null> {
		try {
			const factory = new AiProviderFactory(this.plugin.settings);
			let model: any = null;
			let chosenProvider: AiProvider | undefined;
			let chosenModelId: string | undefined;

			if (options.provider && options.modelId) {
				chosenProvider = options.provider;
				chosenModelId = options.modelId;
			} else {
				const ai = this.plugin.settings.ai;
				const preferred: Array<{ provider: AiProvider; modelId: string }> = [];

				if (
					ai.lastUsedProvider &&
					factory.hasValidApiKey(ai.lastUsedProvider)
				) {
					const lastModel =
						ai.lastUsedModels?.[ai.lastUsedProvider] || ai.lastUsedModel;
					if (lastModel) {
						const avail = factory.getAvailableModels(ai.lastUsedProvider);
						if (avail.some((m) => m.id === lastModel)) {
							preferred.push({
								provider: ai.lastUsedProvider,
								modelId: lastModel,
							});
						}
					}
				}

				const availableProviders = factory.getAvailableProviders();
				for (const p of availableProviders) {
					if (p.provider === ai.lastUsedProvider && preferred.length > 0)
						continue;
					const lastForP = ai.lastUsedModels?.[p.provider];
					if (lastForP && p.models?.some((m: any) => m.id === lastForP)) {
						preferred.push({ provider: p.provider, modelId: lastForP });
					} else if (p.models && p.models.length > 0) {
						preferred.push({ provider: p.provider, modelId: p.models[0].id });
					}
				}

				if (
					preferred.length === 0 &&
					factory.hasValidApiKey(AiProvider.OPENAI)
				) {
					const fallbackModelId =
						this.plugin.settings.openaiModel || "gpt-4o-mini";
					preferred.push({
						provider: AiProvider.OPENAI,
						modelId: fallbackModelId,
					});
				}

				const pick = preferred[0];
				if (pick) {
					chosenProvider = pick.provider;
					chosenModelId = pick.modelId;
				}
			}

			if (!chosenProvider || !chosenModelId) {
				return null;
			}

			model = factory.createModel(chosenProvider, chosenModelId);

			const system: ModelMessage = {
				role: "system",
				content:
					"You are a succinct summarizer. Create a compact rolling summary of the prior conversation, focusing on goals, decisions, constraints, open items, and file references. Aim for " +
					(options.targetTokens || 400) +
					" tokens or less. Do not include code blocks or long quotes.",
			};

			const older = messages.slice(-40);
			const res = await generateText({
				model,
				temperature: 0.1,
				messages: [system, ...older],
			});
			return (res.text || "").trim();
		} catch (e) {
			console.warn("SummarizerService.summarize error:", e);
			return null;
		}
	}
}
