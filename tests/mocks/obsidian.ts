export class TAbstractFile {
	path: string;
	constructor(path: string) {
		this.path = path;
	}
}

export class TFile extends TAbstractFile {}
export class TFolder extends TAbstractFile {}

type Listener<T = any> = (arg: T) => void;

class Emitter {
	private listeners = new Map<string, Function[]>();

	on<T = any>(event: string, cb: Listener<T>) {
		const arr = this.listeners.get(event) ?? [];
		arr.push(cb as any);
		this.listeners.set(event, arr);
		return () => {
			const list = this.listeners.get(event) ?? [];
			this.listeners.set(
				event,
				list.filter((fn) => fn !== cb)
			);
		};
	}

	emit<T = any>(event: string, payload: T) {
		const arr = this.listeners.get(event) ?? [];
		for (const fn of arr) (fn as Listener<T>)(payload);
	}
}

export class Vault extends Emitter {}

export class App {
	vault = new Vault();
}

export class Component {
	private intervals: number[] = [];
	registerInterval(id: number): number {
		this.intervals.push(id);
		return id;
	}
	onunload() {}
	destroy() {
		for (const id of this.intervals) {
			try {
				clearInterval(id);
			} catch {}
		}
		this.intervals = [];
	}
}

export class Notice {
	message: string;
	timeout?: number;
	constructor(message: string, timeout?: number) {
		this.message = message;
		this.timeout = timeout;
	}
}

export class Modal {
	app: App;
	contentEl: HTMLElement;
	titleEl: { setText: (t: string) => void };
	constructor(app: App) {
		this.app = app;
		const el: any =
			typeof document !== "undefined"
				? document.createElement("div")
				: ({} as any);
		if (el) {
			el.empty = function () {
				this.innerHTML = "";
			};
			el.createEl = function (tag: string, opts?: any) {
				if (typeof document === "undefined") return {} as any;
				const child = document.createElement(tag);
				if (opts?.text) child.textContent = opts.text;
				if (opts?.cls) child.className = opts.cls;
				this.appendChild(child);
				return child;
			};
			el.createDiv = function (cls?: string) {
				if (typeof document === "undefined") return {} as any;
				const child = document.createElement("div");
				if (cls) child.className = cls;
				this.appendChild(child);
				return child;
			};
		}
		this.contentEl = el as any;
		this.titleEl = { setText: (_: string) => {} };
	}
	open() {
		(this as any).onOpen?.();
	}
	close() {
		(this as any).onClose?.();
	}
}

export interface Editor {}
export class MarkdownView {}

export class FileSystemAdapter {}

export function normalizePath(p: string) {
	return p.replace(/\\/g, "/");
}

export class WorkspaceLeaf {}
export class ItemView {
	containerEl: any = {
		children: [
			null,
			{
				empty: () => {},
				addClass: () => {},
				createEl: () => ({ onclick: null }),
			},
		],
	};
	constructor(public leaf?: WorkspaceLeaf) {}
	onOpen(): Promise<void> | void {}
	onClose(): Promise<void> | void {}
}

export class PluginSettingTab {
	app: App;
	plugin: any;
	containerEl: HTMLElement;
	constructor(app: App, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl =
			typeof document !== "undefined"
				? document.createElement("div")
				: ({} as any);
	}
	display(): void {}
}

export class Setting {
	constructor(_containerEl: HTMLElement) {}
	setName(_name: string) {
		return this;
	}
	setDesc(_desc: string) {
		return this;
	}
	addText(cb: (t: any) => any) {
		cb({
			setPlaceholder: () => ({ setValue: () => ({ onChange: () => {} }) }),
		});
		return this;
	}
	addToggle(cb: (t: any) => any) {
		cb({ setValue: () => ({ onChange: () => {} }) });
		return this;
	}
}
