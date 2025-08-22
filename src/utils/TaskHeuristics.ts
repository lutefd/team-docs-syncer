export function shouldAutoPlan(userText: string): boolean {
	const text = (userText || "").toLowerCase();
	if (text.length > 3200) return true;
	const docMultiStepHints = [
		"plan",
		"outline",
		"checklist",
		"steps",
		"break down",
		"strategy",
		"roadmap",
		"organize",
		"structure",
		"audit",
		"review doc",
		"compare",
		"cross-reference",
		"create base",
		"draft rfc",
		"write documentation",
		"document",
		"index",
		"toc",
		"table of contents",
	];
	if (docMultiStepHints.some((k) => text.includes(k))) return true;
	const trivialHints = [
		"what is",
		"define",
		"explain",
		"read",
		"open",
		"show",
		"summarize",
	];
	if (trivialHints.some((k) => text.startsWith(k))) return false;
	return false;
}

export function shouldExtractMemories(
	userText: string,
	assistantText: string,
	proposalsCount: number,
	creationsCount: number
): boolean {
	if (creationsCount > 0 || proposalsCount > 0) return true;
	const blob = `${userText || ""}\n${assistantText || ""}`.toLowerCase();
	const durableHints = [
		"preference",
		"always ",
		"we use",
		"we decided",
		"decision",
		"style",
		"format",
		"tags:",
		"url",
		"link",
		"id:",
		"identifier",
		"deadline",
		"due",
		"owner",
		"contact",
		"team",
		"project",
	];
	if (durableHints.some((k) => blob.includes(k))) return true;
	return false;
}
