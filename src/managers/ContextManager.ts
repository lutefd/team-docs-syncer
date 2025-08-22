import type TeamDocsPlugin from "../../main";
import { TokenEstimator } from "../utils/TokenEstimator";
import { PathUtils } from "../utils/PathUtils";
import type {
	ContextBuildRequest,
	ContextBuildResult,
	ContextPolicy,
	DocSlice,
	MCPOverviewSlice,
} from "../types/Context";
import { TFile } from "obsidian";
import { ContextStorage } from "../services/ContextStorageService";

export class ContextManager {
	private storage: ContextStorage;
	constructor(private plugin: TeamDocsPlugin) {
		this.storage = new ContextStorage(plugin);
	}

	private buildNaiveSummary(messages: any[], limitTokens = 400): string {
		const bullets: string[] = [];
		for (const m of messages) {
			if (m.role === "user") bullets.push(`User: ${this.compress(m.content)}`);
			else if (m.role === "assistant")
				bullets.push(`Assistant: ${this.compress(m.content)}`);
			if (TokenEstimator.estimateTextTokens(bullets.join("\n")) > limitTokens)
				break;
		}
		return bullets.join("\n");
	}

	private compress(text: any, max = 300): string {
		const s = typeof text === "string" ? text : JSON.stringify(text);
		const clean = s
			.replace(/```[\s\S]*?```/g, "")
			.replace(/\s+/g, " ")
			.trim();
		return clean.length > max ? clean.slice(0, max) + "…" : clean;
	}

	private async retrieveDocs(
		query: string,
		k: number,
		snippetLength: number
	): Promise<DocSlice[]> {
		const results: DocSlice[] = [];
		try {
			const hits = this.plugin.markdownIndexService?.search(query, k) || [];
			for (const h of hits) {
				if (
					!PathUtils.isWithinAiScope(h.path, this.plugin.settings.teamDocsPath)
				)
					continue;
				let snippet: string | undefined;
				try {
					const abs = this.plugin.app.vault.getAbstractFileByPath(h.path);
					if (
						abs instanceof TFile &&
						(abs.extension === "md" ||
							abs.extension === "mdx" ||
							abs.extension === "base")
					) {
						const txt = await this.plugin.app.vault.read(abs);
						snippet = txt.slice(0, snippetLength);
					}
				} catch {}
				results.push({ type: "doc", path: h.path, title: h.title, snippet });
			}
		} catch {}
		return results;
	}

	private async buildMCPSlice(
		selectedIds: string[] | undefined
	): Promise<MCPOverviewSlice | null> {
		if (!selectedIds || selectedIds.length === 0) return null;
		try {
			const all = await this.plugin.mcpManager.listAllTools();
			const selected = all.filter((c) => selectedIds.includes(c.clientId));
			return {
				type: "mcp-overview",
				clients: selected.map((c) => ({
					clientId: c.clientId,
					clientName: c.clientName,
					tools: (c.tools || []).slice(0, 5).map((t: any) => t.name || "tool"),
				})),
			};
		} catch {
			return null;
		}
	}

	private buildSystemAugment(opts: {
		summary?: string | null;
		docs: DocSlice[];
		mcp?: MCPOverviewSlice | null;
		pinned: string[];
		memories?: Array<{ content: string; type?: string }>;
		scratchpadRecent?: string | null;
	}): string {
		const parts: string[] = [];
		if (opts.summary) {
			parts.push(`Conversation Summary:\n${opts.summary}`);
		}
		if (opts.scratchpadRecent) {
			parts.push(
				`Planning Scratchpad (recent):\n${opts.scratchpadRecent}\n\nNOTE: Use planning tools to update this scratchpad if needed.`
			);
		}
		if (opts.docs.length) {
			const lines = opts.docs
				.map(
					(d, i) =>
						`#${i + 1} ${d.path}\nTitle: ${d.title}\nSnippet: ${
							d.snippet || ""
						}`
				)
				.join("\n\n");
			parts.push(
				`Relevant Docs (keep references only, do not assume content):\n${lines}`
			);
		}
		if (opts.pinned?.length) {
			parts.push(
				`Pinned Files:\n${opts.pinned
					.map((p, i) => `#${i + 1} ${p}`)
					.join("\n")}`
			);
		}
		if (opts.memories && opts.memories.length) {
			const mem = opts.memories
				.slice(0, 5)
				.map((m, i) => `- ${m.content}`)
				.join("\n");
			parts.push(`Memories:\n${mem}`);
		}
		if (opts.mcp) {
			const m = opts.mcp;
			const block = m.clients
				.map((c) => `- ${c.clientName}: ${c.tools.join(", ")}`)
				.join("\n");
			parts.push(`MCP Tools Available (prefer when superior):\n${block}`);
		}
		return parts.join("\n\n");
	}

	async buildContext(
		req: ContextBuildRequest,
		policy: ContextPolicy
	): Promise<ContextBuildResult> {
		const kept = req.messages.slice(-policy.historyMaxMessages);
		let est = TokenEstimator.estimateMessagesTokens(kept);

		let summarized = false;
		let summaryText: string | null = null;
		if (est > policy.summarizeOverTokens) {
			summarized = true;
			const older = req.messages.slice(
				0,
				Math.max(0, req.messages.length - policy.historyMaxMessages)
			);
			summaryText = this.buildNaiveSummary(older);
		}

		let docs: DocSlice[] = [];
		if (policy.retrieval.enableVault) {
			const last = kept.filter((m) => m.role === "user").pop();
			const query = typeof last?.content === "string" ? last.content : "";
			if (query) {
				docs = await this.retrieveDocs(
					query,
					policy.retrieval.k,
					policy.retrieval.snippetLength
				);
			}
		}

		const mcp = policy.includeMCPOverview
			? await this.buildMCPSlice(req.mcpSelection?.clientIds)
			: null;
		const pinned = this.plugin.chatSessionService.getPinned();
		const memories = await this.storage.readMemories(req.sessionId);
		const scratchpadRecent = await this.storage.readScratchpadRecent(
			req.sessionId,
			2
		);
		const systemAugment = this.buildSystemAugment({
			summary: summaryText,
			docs,
			mcp,
			pinned,
			memories,
			scratchpadRecent,
		});

		est =
			TokenEstimator.estimateMessagesTokens(kept) +
			TokenEstimator.estimateTextTokens(systemAugment);

		return {
			systemAugment,
			trimmedMessages: kept,
			summaryText: summaryText,
			metrics: {
				inputTokensEstimated: est,
				prunedTokens: 0,
				summarized,
				retrievalCount: docs.length,
			},
		};
	}
}
