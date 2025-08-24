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
	settingEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.settingEl = (
			typeof document !== "undefined"
				? document.createElement("div")
				: ({} as any)
		) as any;
		if (!(this.settingEl as any).classList) {
			(this.settingEl as any).classList = { add: () => {} } as any;
		}
		(containerEl as any)?.appendChild?.(this.settingEl);
	}
	setName(_name: string) {
		return this;
	}
	setDesc(_desc: string) {
		return this;
	}
	addText(cb: (t: any) => any) {
		const input =
			typeof document !== "undefined"
				? document.createElement("input")
				: ({} as any);
		if (input) {
			(input as any).type = "text";
			this.settingEl.appendChild(input as any);
		}
		const api: any = {
			setPlaceholder: (p?: string) => {
				if (input && p) (input as any).placeholder = p;
				return {
					setValue: (v?: string) => {
						if (input && typeof v !== "undefined") (input as any).value = v;
						return {
							onChange: (fn: (v: string) => any) => {
								if (
									input &&
									typeof (input as any).addEventListener === "function"
								) {
									(input as any).addEventListener("input", (e: any) =>
										fn(e.target.value)
									);
								}
							},
						};
					},
				};
			},
		};
		cb(api);
		return this;
	}
	addToggle(cb: (t: any) => any) {
		const checkbox =
			typeof document !== "undefined"
				? document.createElement("input")
				: ({} as any);
		if (checkbox) {
			(checkbox as any).type = "checkbox";
			this.settingEl.appendChild(checkbox as any);
		}
		const api: any = {
			setValue: (v?: boolean) => {
				if (checkbox && typeof v !== "undefined") (checkbox as any).checked = v;
				return {
					onChange: (fn: (v: boolean) => any) => {
						if (
							checkbox &&
							typeof (checkbox as any).addEventListener === "function"
						) {
							(checkbox as any).addEventListener("change", (e: any) =>
								fn(!!e.target.checked)
							);
						}
					},
				};
			},
		};
		cb(api);
		return this;
	}
	addDropdown(cb: (t: any) => any) {
		const select =
			typeof document !== "undefined"
				? document.createElement("select")
				: ({} as any);
		if (select) {
			this.settingEl.appendChild(select as any);
		}
		const api: any = {
			addOption: (value: string, label: string) => {
				if (select) {
					const opt = document.createElement("option");
					opt.value = value;
					opt.textContent = label;
					(select as any).appendChild(opt);
				}
				return api;
			},
			setValue: (v: string) => {
				if (select) (select as any).value = v;
				return api;
			},
			onChange: (fn: (v: string) => any) => {
				if (select && typeof (select as any).addEventListener === "function") {
					(select as any).addEventListener("change", (e: any) =>
						fn(e.target.value)
					);
				}
				return api;
			},
		};
		cb(api);
		return this;
	}
	addButton(cb: (t: any) => any) {
		const btn =
			typeof document !== "undefined"
				? document.createElement("button")
				: ({} as any);
		if (btn) this.settingEl.appendChild(btn as any);
		const api: any = {
			setButtonText: (t: string) => {
				if (btn) (btn as any).textContent = t;
				return api;
			},
			setCta: () => api,
			onClick: (fn: () => any) => {
				if (btn) (btn as any).onclick = fn;
				return api;
			},
		};
		cb(api);
		return this;
	}
}
