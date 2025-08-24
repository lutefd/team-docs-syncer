import {
	shouldAutoPlan,
	shouldExtractMemories,
} from "../../src/utils/TaskHeuristics";

describe("TaskHeuristics", () => {
	describe("shouldAutoPlan", () => {
		test("returns true for very long inputs (>3200)", () => {
			const long = "a".repeat(3201);
			expect(shouldAutoPlan(long)).toBe(true);
		});

		test("returns true when multi-step planning hints are present", () => {
			expect(shouldAutoPlan("Please outline the strategy for this doc")).toBe(
				true
			);
			expect(shouldAutoPlan("Create base for our TOC")).toBe(true);
			expect(shouldAutoPlan("Draft RFC to organize sections")).toBe(true);
		});

		test("returns false for trivial starters", () => {
			expect(shouldAutoPlan("What is a monorepo?")).toBe(false);
			expect(shouldAutoPlan("Define terms used")).toBe(false);
			expect(shouldAutoPlan("Summarize the doc")).toBe(false);
		});

		test("returns false by default for short text without hints", () => {
			expect(shouldAutoPlan("Quick note")).toBe(false);
		});
	});

	describe("shouldExtractMemories", () => {
		test("returns true when there are proposals or creations", () => {
			expect(shouldExtractMemories("u", "a", 1, 0)).toBe(true);
			expect(shouldExtractMemories("u", "a", 0, 2)).toBe(true);
		});

		test("returns true when durable hints appear in user or assistant text", () => {
			expect(shouldExtractMemories("We decided to use tabs", "", 0, 0)).toBe(
				true
			);
			expect(shouldExtractMemories("", "Our deadline is next week", 0, 0)).toBe(
				true
			);
			expect(
				shouldExtractMemories("Contact: alice@example.com", "", 0, 0)
			).toBe(true);
			expect(shouldExtractMemories("URL: https://example.com", "", 0, 0)).toBe(
				true
			);
			expect(shouldExtractMemories("Tags: project, team", "", 0, 0)).toBe(true);
		});

		test("returns false when no hints and no proposals/creations", () => {
			expect(shouldExtractMemories("random chat", "just chatting", 0, 0)).toBe(
				false
			);
		});
	});
});
