export class JsonRpcMessageProcessor {
	private messageBuffer = "";
	private messageQueue: string[] = [];
	private onMessageCallback: ((data: any) => void) | null = null;

	processChunk(chunk: string): void {
		this.messageBuffer += chunk;
		this.extractJsonRpcMessages();
		this.messageBuffer = this.cleanBuffer(this.messageBuffer);
		this.processQueuedMessages();
	}

	setMessageCallback(callback: (data: any) => void): void {
		this.onMessageCallback = callback;
		this.processQueuedMessages();
	}

	getMessageCallback(): ((data: any) => void) | null {
		return this.onMessageCallback;
	}

	private extractJsonRpcMessages(): void {
		const lines = this.messageBuffer.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || this.isDebugLine(trimmed) || !trimmed.startsWith("{")) {
				continue;
			}

			try {
				const parsed = JSON.parse(trimmed);
				if (this.isValidJsonRpc(parsed)) {
					this.messageQueue.push(trimmed);
				}
			} catch (error) {
				continue;
			}
		}
	}

	private processQueuedMessages(): void {
		while (this.messageQueue.length > 0 && this.onMessageCallback) {
			const message = this.messageQueue.shift()!;
			try {
				const parsedMessage = JSON.parse(message);
				this.onMessageCallback(parsedMessage);
			} catch (error) {
				console.error(`Error processing MCP message:`, error);
			}
		}
	}

	private cleanBuffer(buffer: string): string {
		const lines = buffer.split("\n");
		return lines[lines.length - 1] || "";
	}

	private isDebugLine(line: string): boolean {
		const debugPatterns = [
			/^(DEBUG|INFO|WARN|ERROR|TRACE):/i,
			/^console\./i,
			/^Loading/i,
			/^Initializing/i,
			/^Starting/i,
			/^Found/i,
			/^Processing/i,
			/^\[.*\]/,
			/^\d{4}-\d{2}-\d{2}/,
			/^[A-Za-z]+\s+\d+/,
		];

		return debugPatterns.some((pattern) => pattern.test(line));
	}

	private isValidJsonRpc(obj: any): boolean {
		if (typeof obj !== "object" || obj === null) {
			return false;
		}

		if (obj.jsonrpc === "2.0") {
			return true;
		}

		return (
			typeof obj.id !== "undefined" ||
			typeof obj.method === "string" ||
			typeof obj.result !== "undefined" ||
			typeof obj.error !== "undefined"
		);
	}
}
