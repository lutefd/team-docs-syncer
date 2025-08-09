import { App, TFile } from "obsidian";

export function createMockApp() {
	const app = new (App as any)() as App;
	const listeners = new Map<string, Function[]>();
	(app as any).workspace = {
		on: jest.fn((evt: string, cb: any) => {
			const arr = listeners.get(evt) ?? [];
			arr.push(cb);
			listeners.set(evt, arr);
			return () =>
				listeners.set(
					evt,
					(listeners.get(evt) ?? []).filter((f) => f !== cb)
				);
		}),
		emit: (evt: string, ...args: any[]) => {
			for (const fn of listeners.get(evt) ?? []) fn(...args);
		},
		getActiveFile: jest.fn(() => null as unknown as TFile | null),
		getLeavesOfType: jest.fn(() => []),
		revealLeaf: jest.fn(),
		detachLeavesOfType: jest.fn(),
		getRightLeaf: jest.fn(() => ({ setViewState: jest.fn() })),
		getActiveViewOfType: jest.fn(() => null),
	};
	(app as any).fileManager = { renameFile: jest.fn() };
	(app as any).vault.createFolder = jest.fn();
	(app as any).vault.getAbstractFileByPath = jest.fn();
	return app;
}

export function createMockPlugin(app: App) {
	const gitService = {
		syncTeamDocs: jest.fn(),
		forcePullTeamDocs: jest.fn(),
		restoreFileFromGit: jest.fn(),
		getTeamDocsPath: jest.fn(async () => "/abs/teamdocs"),
		gitCommand: jest.fn(async () => ({ stdout: "", stderr: "" })),
	};

	const reservationManager = {
		reserveFile: jest.fn(async () => true),
		releaseFile: jest.fn(async () => {}),
		releaseReservationByPath: jest.fn(async () => {}),
		extendReservation: jest.fn(async () => true),
		getFileReservation: jest.fn(() => null as any),
		getMyReservations: jest.fn(() => []),
		syncReservationsFromGit: jest.fn(async () => {}),
	};

	const uiManager = {
		updateFileReservationUI: jest.fn(),
		openActivityFeed: jest.fn(),
		enforceReadView: jest.fn(),
	};

	const statusIndicator = {
		updateStatus: jest.fn(),
	};

	const plugin: any = {
		app,
		settings: {
			teamDocsPath: "Team/Docs",
			attachmentsSubdir: "assets",
			userName: "me",
			gitRemoteUrl: "https://example.com/repo.git",
			userEmail: "me@example.com",
			autoSyncOnStartup: false,
			autoSyncInterval: 0,
		},
		saveSettings: jest.fn(async () => {}),
		addRibbonIcon: jest.fn(),
		addCommand: jest.fn(),
		addStatusBarItem: jest.fn(() => {
			const spans: any[] = [];
			return {
				classList: { add: jest.fn() },
				addClass: jest.fn(),
				empty: jest.fn(function (this: any) {
					this.innerHTML = "";
				}),
				createSpan: jest.fn((opts?: any) => {
					const el = document.createElement("span");
					if (opts?.cls) el.className = opts.cls;
					spans.push(el);
					return el as any;
				}),
				setAttribute: jest.fn(),
				title: "",
				onclick: null as any,
				getBoundingClientRect: jest.fn(() => ({
					left: 0,
					top: 50,
					bottom: 60,
					width: 100,
					height: 20,
				})),
			} as any;
		}),
		registerEvent: jest.fn((deregister: any) => deregister),
		gitService,
		reservationManager,
		uiManager,
		statusIndicator,
	};
	return plugin;
}
