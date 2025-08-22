import { z } from "zod";
import { tool } from "ai";
import type TeamDocsPlugin from "../../../main";
import { withRetry } from "./utils";
import { ContextStorage } from "../../services/ContextStorageService";

export function createPlanningTools(plugin: TeamDocsPlugin) {
	const storage = new ContextStorage(plugin);

	return {
		planning_read: tool({
			description:
				"Read the entire planning scratchpad for the current session. Use when you need full context beyond the recent snippet.",
			inputSchema: z.object({}),
			execute: async () => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					const content = (await storage.readScratchpad(sessionId)) ?? "";
					return { ok: true, content };
				});
			},
		}),

		planning_update_section: tool({
			description:
				"Update a specific section in the planning scratchpad (Goals, Plan, Progress, Next, Decisions) by replacing its content.",
			inputSchema: z.object({
				section: z.enum(["Goals", "Plan", "Progress", "Next", "Decisions"]),
				content: z.string().max(20000),
			}),
			execute: async ({
				section,
				content,
			}: {
				section: "Goals" | "Plan" | "Progress" | "Next" | "Decisions";
				content: string;
			}) => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					await storage.updateScratchpadSection(sessionId, section, content);
					return { ok: true };
				});
			},
		}),

		planning_replace: tool({
			description:
				"Replace the entire planning scratchpad content. Provide the full desired content (this overwrites the file).",
			inputSchema: z.object({
				content: z.string().max(50000),
			}),
			execute: async ({ content }: { content: string }) => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					await storage.writeScratchpad(sessionId, content);
					return { ok: true };
				});
			},
		}),
		planning_write: tool({
			description:
				"Append a short planning note or next step to the session scratchpad (stored under the plugin's per-session folder). Keep entries concise.",
			inputSchema: z.object({
				text: z
					.string()
					.min(1)
					.max(4000)
					.describe(
						"Short plan, checklist item, or step description to append."
					),
			}),
			execute: async ({ text }: { text: string }) => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					await storage.appendScratchpad(sessionId, text);
					return { ok: true };
				});
			},
		}),

		memories_add: tool({
			description:
				"Store a small memory relevant to this session (fact, preference, or entity). These are persisted and may be surfaced in context for recall.",
			inputSchema: z.object({
				content: z.string().min(1).max(2000),
				type: z.enum(["fact", "preference", "entity"]).optional(),
				tags: z.array(z.string()).optional(),
			}),
			execute: async ({
				content,
				type = "fact",
				tags = [],
			}: {
				content: string;
				type?: "fact" | "preference" | "entity";
				tags?: string[];
			}) => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					const items = (await storage.readMemories(sessionId)) || [];
					items.push({
						id: `mem_${Date.now()}`,
						type,
						content,
						tags,
						createdAt: Date.now(),
					});
					await storage.writeMemories(sessionId, items);
					return { ok: true };
				});
			},
		}),

		memories_list: tool({
			description:
				"List recent stored memories for this session to assist recall. Useful before planning or executing multi-step tasks.",
			inputSchema: z.object({
				limit: z.number().int().min(1).max(50).optional(),
			}),
			execute: async ({ limit = 10 }: { limit?: number }) => {
				return withRetry(async () => {
					const sessionId = plugin.chatSessionService.getActive()?.id;
					if (!sessionId) return { ok: false, message: "No active session" };
					const items = await storage.readMemories(sessionId);
					return { ok: true, items: items.slice(-limit) };
				});
			},
		}),
	};
}
