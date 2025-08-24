import { TokenEstimator } from "../../src/utils/TokenEstimator";

describe("TokenEstimator", () => {
	describe("estimateTextTokens", () => {
		test("returns 0 for empty or falsy", () => {
			expect(TokenEstimator.estimateTextTokens("")).toBe(0);
			expect(TokenEstimator.estimateTextTokens(undefined as any)).toBe(0);
			expect(TokenEstimator.estimateTextTokens(null as any)).toBe(0);
		});

		test("ceil(chars/4) behavior", () => {
			expect(TokenEstimator.estimateTextTokens("a")).toBe(1);
			expect(TokenEstimator.estimateTextTokens("ab")).toBe(1);
			expect(TokenEstimator.estimateTextTokens("abc")).toBe(1);
			expect(TokenEstimator.estimateTextTokens("abcd")).toBe(1);
			expect(TokenEstimator.estimateTextTokens("abcde")).toBe(2);
		});
	});

	describe("estimateMessagesTokens", () => {
		test("string content adds base + overhead per message", () => {
			const messages = [
				{ role: "user", content: "hi" },
				{ role: "assistant", content: "there" },
			];
			expect(TokenEstimator.estimateMessagesTokens(messages)).toBe(15);
		});

		test("array content stringified, object content stringified", () => {
			const arrContent = [{ type: "text", text: "hello" }];
			const objContent = { text: "world" };
			const baseArr = Math.ceil(JSON.stringify(arrContent).length / 4);
			const baseObj = Math.ceil(JSON.stringify(objContent).length / 4);
			const expected = baseArr + 6 + (baseObj + 6);
			expect(
				TokenEstimator.estimateMessagesTokens([
					{ role: "user", content: arrContent },
					{ role: "assistant", content: objContent },
				])
			).toBe(expected);
		});

		test("handles empty array and empty object gracefully", () => {
			const expected =
				Math.ceil(JSON.stringify([]).length / 4) +
				6 +
				Math.ceil(JSON.stringify({}).length / 4) +
				6;
			expect(
				TokenEstimator.estimateMessagesTokens([
					{ role: "user", content: [] },
					{ role: "assistant", content: {} },
				])
			).toBe(expected);
		});
	});
});
