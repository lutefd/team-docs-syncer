try {
	const anyGlobal: any = globalThis as any;
	if (typeof anyGlobal.TransformStream === "undefined") {
		const web = require("stream/web");
		if (web?.TransformStream) anyGlobal.TransformStream = web.TransformStream;
		if (web?.ReadableStream) anyGlobal.ReadableStream = web.ReadableStream;
		if (web?.WritableStream) anyGlobal.WritableStream = web.WritableStream;
	}
} catch {}

if (typeof (global as any).TextEncoder === "undefined") {
	const util = require("util");
	(global as any).TextEncoder = util.TextEncoder;
	(global as any).TextDecoder = util.TextDecoder;
}
