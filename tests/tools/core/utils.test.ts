import { withRetry, cleanAndResolvePath } from "../../../src/tools/core/utils";

jest.mock("../../../src/utils/PathUtils", () => ({
	PathUtils: {
		isWithinAiScope: jest.fn(),
	},
}));

const { PathUtils } = require("../../../src/utils/PathUtils");

describe("withRetry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("returns immediately on success (no retries)", async () => {
		const op = jest.fn(async () => "ok");
		const res = await withRetry(op, 3, 50);
		expect(res).toBe("ok");
		expect(op).toHaveBeenCalledTimes(1);
	});

	test("retries with linear backoff and eventually succeeds", async () => {
		jest.useFakeTimers();
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const setTimeoutSpy = jest.spyOn(global, "setTimeout");

		let attempts = 0;
		const op = jest.fn(async () => {
			attempts++;
			if (attempts < 3) throw new Error(`fail-${attempts}`);
			return "ok";
		});

		const p = withRetry(op, 3, 100);

		await Promise.resolve();
		expect(op).toHaveBeenCalledTimes(1);
		expect(setTimeoutSpy.mock.calls[0][1]).toBe(100);

		jest.advanceTimersByTime(100);
		await Promise.resolve();
		await Promise.resolve();
		expect(op).toHaveBeenCalledTimes(2);
		expect(setTimeoutSpy.mock.calls[1][1]).toBe(200);

		jest.advanceTimersByTime(200);
		await Promise.resolve();
		const res = await p;
		expect(res).toBe("ok");

		expect(warn).toHaveBeenCalledTimes(2);
		expect(String(warn.mock.calls[0][0])).toContain("attempt 1/3");
		expect(String(warn.mock.calls[1][0])).toContain("attempt 2/3");

		warn.mockRestore();
		jest.useRealTimers();
	});

	test("throws after maxRetries with warnings emitted", async () => {
		jest.useFakeTimers();
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

		const op = jest.fn(async () => {
			throw new Error("boom");
		});

		const p = withRetry(op, 2, 50);

		await Promise.resolve();
		jest.advanceTimersByTime(50);

		await expect(p).rejects.toThrow("boom");
		expect(op).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
		jest.useRealTimers();
	});
});

describe("cleanAndResolvePath", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("returns original path when not a wiki-link", () => {
		const out = cleanAndResolvePath("docs/file.md", "/team");
		expect(out).toBe("docs/file.md");
		expect(PathUtils.isWithinAiScope).not.toHaveBeenCalled();
	});

	test("converts [[Note]] to Note.md and prefixes teamRoot when outside AI scope", () => {
		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
		const out = cleanAndResolvePath("[[Note]]", "/team");
		expect(out).toBe("/team/Note.md");
		expect(PathUtils.isWithinAiScope).toHaveBeenCalledWith("Note.md", "/team");
	});

	test("preserves .md and no prefix when already within scope", () => {
		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(true);
		const out = cleanAndResolvePath("[[Agenda.md]]", "/team");
		expect(out).toBe("Agenda.md");
		expect(PathUtils.isWithinAiScope).toHaveBeenCalledWith(
			"Agenda.md",
			"/team"
		);
	});
});
