export class TokenEstimator {
	static estimateTextTokens(text: string): number {
		if (!text) return 0;
		const chars = text.length;
		return Math.ceil(chars / 4);
	}

	static estimateMessagesTokens(
		messages: Array<{ role: string; content: any }>
	): number {
		let total = 0;
		for (const m of messages) {
			let contentStr = "";
			if (typeof m.content === "string") contentStr = m.content;
			else if (Array.isArray(m.content)) contentStr = JSON.stringify(m.content);
			else if (m.content && typeof m.content === "object")
				contentStr = JSON.stringify(m.content);
			const base = this.estimateTextTokens(contentStr);
			const overhead = 6;
			total += base + overhead;
		}
		return total;
	}
}
