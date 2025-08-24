import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

const appendScratchpadMock = jest.fn();

jest.mock("../../src/services/ContextStorageService", () => ({
	ContextStorage: jest.fn().mockImplementation(() => ({
		appendScratchpad: (...args: any[]) => appendScratchpadMock(...args),
	})),
}));

describe("PlanWriter", () => {
	let app: App;
	let plugin: any;
	let PlanWriter: any;

	beforeEach(() => {
		jest.clearAllMocks();
		app = createMockApp();
		plugin = createMockPlugin(app);
		({ PlanWriter } = require("../../src/services/PlanWriterService"));
	});

	function nextTick() {
		return new Promise((r) => setTimeout(r, 0));
	}

	test("append enqueues and flushes in FIFO order", async () => {
		appendScratchpadMock.mockResolvedValue(undefined);
		const w = new PlanWriter(plugin);

		w.append("s", "A");
		w.append("s", "B");
		w.append("s", "C");

		await nextTick();

		expect(appendScratchpadMock).toHaveBeenCalledTimes(3);
		expect(appendScratchpadMock.mock.calls[0]).toEqual(["s", "A"]);
		expect(appendScratchpadMock.mock.calls[1]).toEqual(["s", "B"]);
		expect(appendScratchpadMock.mock.calls[2]).toEqual(["s", "C"]);
	});

	test("non-reentrant: processes sequentially even with concurrent appends", async () => {
		const deferreds: Array<
			{ resolve: Function; reject: Function } & Promise<void>
		> = [] as any;
		appendScratchpadMock.mockImplementation(() => {
			let res!: Function, rej!: Function;
			const p: any = new Promise<void>((r, j) => {
				res = r;
				rej = j;
			});
			(p as any).resolve = res;
			(p as any).reject = rej;
			deferreds.push(p);
			return p;
		});

		const w = new PlanWriter(plugin);
		w.append("s", "1");
		w.append("s", "2");
		w.append("s", "3");

		expect(appendScratchpadMock).toHaveBeenCalledTimes(1);
		(deferreds.shift() as any).resolve();
		await nextTick();
		expect(appendScratchpadMock).toHaveBeenCalledTimes(2);

		(deferreds.shift() as any).resolve();
		await nextTick();
		expect(appendScratchpadMock).toHaveBeenCalledTimes(3);
		(deferreds.shift() as any).resolve();
		await nextTick();
		expect(appendScratchpadMock).toHaveBeenCalledTimes(3);
		const texts = appendScratchpadMock.mock.calls.map((c: any[]) => c[1]);
		expect(texts).toEqual(["1", "2", "3"]);
	});

	test("on error: logs warning, stops current flush, preserves remaining queue, resumes on next append", async () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

		let callIndex = 0;
		appendScratchpadMock.mockImplementation(async () => {
			callIndex++;
			if (callIndex === 1) return;
			if (callIndex === 2) throw new Error("boom");
			return;
		});

		const w = new PlanWriter(plugin);
		w.append("s", "x1");
		w.append("s", "x2");
		w.append("s", "x3");

		await nextTick();

		expect(appendScratchpadMock).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalled();

		appendScratchpadMock.mockResolvedValue(undefined);
		w.append("s", "x4");

		await nextTick();

		expect(appendScratchpadMock).toHaveBeenCalledTimes(4);
		const texts = appendScratchpadMock.mock.calls.map((c: any[]) => c[1]);
		expect(texts).toEqual(["x1", "x2", "x3", "x4"]);

		warn.mockRestore();
	});
});
