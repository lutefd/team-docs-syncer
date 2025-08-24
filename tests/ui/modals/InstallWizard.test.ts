/** @jest-environment jsdom */
import { App, FileSystemAdapter } from "obsidian";
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import { InstallWizard } from "../../../src/ui/modals/InstallWizard";
import * as fs from "fs";
import * as fsp from "fs/promises";

jest.mock("fs", () => ({
	__esModule: true,
	existsSync: jest.fn(() => false),
}));
jest.mock("fs/promises", () => ({
	__esModule: true,
	rename: jest.fn(async () => undefined),
}));

class MockAdapter extends (FileSystemAdapter as any) {
	base: string;
	constructor(base: string) {
		super();
		this.base = base;
	}
	getFullPath(rel: string) {
		if (!rel) return this.base;
		return `${this.base}/${rel}`.replace(/\\/g, "/");
	}
}

describe("InstallWizard", () => {
	let app: App;
	let plugin: any;
	let existsMock: jest.Mock;
	let renameMock: jest.Mock;

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).addClass = function (cls: string) {
			this.classList.add(cls);
		};
		(Element.prototype as any).setText = function (t: string) {
			this.textContent = t;
		};
		(Element.prototype as any).setAttr = function (k: string, v: string) {
			this.setAttribute(k, v);
		};

		app = createMockApp();
		plugin = createMockPlugin(app);

		(app as any).vault.adapter = new MockAdapter("/vault");

		existsMock = fs.existsSync as unknown as jest.Mock;
		existsMock.mockReturnValue(false);
		renameMock = fsp.rename as unknown as jest.Mock;
		renameMock.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function openWizard() {
		const wiz = new InstallWizard(app, plugin);
		wiz.onOpen();
		return wiz as any;
	}

	test("Full happy path: clone -> rename -> git config -> done", async () => {
		const wiz = openWizard();

		const repoInput = wiz.contentEl.querySelector("input") as HTMLInputElement;
		const cloneBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Clone Repository"
		) as HTMLButtonElement;

		repoInput.value = "https://github.com/lutefd/team-docs-syncer.git";

		await (cloneBtn as any).onclick();

		expect(plugin.gitService.gitCommandRetry).toHaveBeenCalled();
		const [parentDir, cloneCmd] = (
			plugin.gitService.gitCommandRetry as jest.Mock
		).mock.calls[0];
		expect(parentDir).toBe("/vault");
		expect(cloneCmd).toMatch(
			/clone \"https:\/\/github.com\/lutefd\/team-docs-syncer.git\" \"\/vault\/team-docs-syncer\"/
		);

		expect(wiz.contentEl.textContent).toContain(
			"What should this folder be called inside your vault?"
		);

		const nameInput = wiz.contentEl.querySelector("input") as HTMLInputElement;
		const nextBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Next"
		) as HTMLButtonElement;

		nameInput.value = "DocsNew";

		existsMock.mockReturnValue(false);

		await (nextBtn as any).onclick();

		expect(renameMock).toHaveBeenCalled();
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(plugin.settings.teamDocsPath).toBe("DocsNew");
		expect(plugin.settings.gitRemoteUrl).toBe(
			"https://github.com/lutefd/team-docs-syncer.git"
		);
		expect(plugin.settings.attachmentsSubdir).toBe("Meta/Attachments");

		expect(wiz.contentEl.textContent).toContain(
			"Configure your Git identity for this repository."
		);
		const inputs = Array.from(
			wiz.contentEl.querySelectorAll("input")
		) as HTMLInputElement[];
		const nameCfg = inputs.find((i) => i.type === "text")!;
		const emailCfg = inputs.find((i) => i.type === "email")!;
		const finishBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Finish Setup"
		) as HTMLButtonElement;

		nameCfg.value = "Alice";
		emailCfg.value = "alice@example.com";

		await (finishBtn as any).onclick();

		const calls = (plugin.gitService.gitCommandRetry as jest.Mock).mock.calls;
		expect(calls.length).toBeGreaterThanOrEqual(4);
		const cmdStrings = calls.slice(1).map((c) => c[1]);
		expect(cmdStrings.join("\n")).toContain("config pull.rebase false");
		expect(cmdStrings.join("\n")).toContain('config user.name "Alice"');
		expect(cmdStrings.join("\n")).toContain(
			'config user.email "alice@example.com"'
		);

		expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
		expect(plugin.settings.userName).toBe("Alice");
		expect(plugin.settings.userEmail).toBe("alice@example.com");

		expect(wiz.contentEl.textContent).toContain("Setup Complete");

		const closeBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Close"
		) as HTMLButtonElement;
		expect(plugin.installingWizard).toBe(true);
		closeBtn.click();
		expect(plugin.installingWizard).toBe(false);
	});

	test("Back buttons navigate to previous steps", async () => {
		const wiz = openWizard();

		const repoInput = wiz.contentEl.querySelector("input") as HTMLInputElement;
		repoInput.value = "https://github.com/lutefd/team-docs-syncer.git";
		const cloneBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Clone Repository"
		) as HTMLButtonElement;
		await (cloneBtn as any).onclick();

		const backBtn1 = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Back"
		) as HTMLButtonElement;
		backBtn1.click();
		expect(wiz.contentEl.textContent).toContain("Enter the Git remote URL");

		(wiz.contentEl.querySelector("input") as HTMLInputElement).value =
			"https://github.com/lutefd/team-docs-syncer.git";
		await (cloneBtn as any).onclick();
		const nextBtn = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Next"
		) as HTMLButtonElement;
		await (nextBtn as any).onclick();

		const backBtn2 = Array.from(wiz.contentEl.querySelectorAll("button")).find(
			(b: HTMLButtonElement) => b.textContent === "Back"
		) as HTMLButtonElement;
		backBtn2.click();
		expect(wiz.contentEl.textContent).toContain(
			"What should this folder be called inside your vault?"
		);
	});
});
