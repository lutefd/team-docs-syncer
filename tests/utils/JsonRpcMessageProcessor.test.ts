import { JsonRpcMessageProcessor } from "../../src/utils/JsonRpcMessageProcessor";

describe("JsonRpcMessageProcessor", () => {
	let proc: JsonRpcMessageProcessor;
	let received: any[];

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		proc = new JsonRpcMessageProcessor();
		received = [];
	});

	test("processes valid JSON-RPC lines and ignores debug/noise", () => {
		proc.setMessageCallback((msg) => received.push(msg));

		const chunk = [
			"DEBUG: starting...",
			'{"jsonrpc":"2.0","method":"ping"}',
			"not json here",
			'{"id":1,"result":"ok"}',
			"2024-01-01 boot",
			"[info] something",
			"console.log('x')",
			"",
		].join("\n");

		proc.processChunk(chunk + "\n");

		expect(received).toEqual([
			{ jsonrpc: "2.0", method: "ping" },
			{ id: 1, result: "ok" },
		]);
	});

	test("queues messages until callback set, then flushes in order", () => {
		const chunk = '{"jsonrpc":"2.0","method":"a"}\n{"method":"b"}\n';
		proc.processChunk(chunk);
		expect(received.length).toBe(0);

		proc.setMessageCallback((msg) => received.push(msg));

		expect(received).toEqual([
			{ jsonrpc: "2.0", method: "a" },
			{ method: "b" },
		]);
	});

	test("handles partial JSON across chunks using buffer clean/append", () => {
		proc.setMessageCallback((msg) => received.push(msg));

		proc.processChunk('{"jsonrpc":"2.0","met');
		expect(received.length).toBe(0);

		proc.processChunk('hod":"pong"}\n{"method":"ok"}\n');

		expect(received).toEqual([
			{ jsonrpc: "2.0", method: "pong" },
			{ method: "ok" },
		]);
	});

	test("ignores malformed JSON lines without throwing and continues", () => {
		proc.setMessageCallback((msg) => received.push(msg));

		const chunk =
			'{"jsonrpc":"2.0","method":"good"}\n{bad json}\n{"id":2,"result":true}\n';
		proc.processChunk(chunk);

		expect(received).toEqual([
			{ jsonrpc: "2.0", method: "good" },
			{ id: 2, result: true },
		]);
	});

	test("accepts messages that look like JSON-RPC even without jsonrpc field (by method/id/result/error)", () => {
		proc.setMessageCallback((msg) => received.push(msg));

		proc.processChunk('{"method":"notify"}\n');
		expect(received).toEqual([{ method: "notify" }]);
	});
});
