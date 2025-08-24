/** @jest-environment jsdom */
import { App, FileSystemAdapter } from "obsidian";
import { TeamDocsSettingTab } from "../../src/ui/SettingsTab";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("TeamDocsSettingTab", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).appendText = function (text: string) {
			this.appendChild(document.createTextNode(text));
		};
		(Element.prototype as any).createEl = function (tag: string, opts?: any) {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) el.className = opts.cls;
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).createDiv = function (cls?: string) {
			const el = document.createElement("div");
			if (cls) el.className = cls;
			this.appendChild(el);
			return el;
		};

		app = createMockApp();
		plugin = createMockPlugin(app);
	});

	test("display renders header and desktop warning when not FileSystemAdapter", () => {
		(app as any).vault.adapter = {} as any;
		const tab = new TeamDocsSettingTab(app, plugin);

		tab.display();

		expect(tab.containerEl.querySelector("h2")?.textContent).toMatch(
			/Team Docs Git Sync Settings/
		);
		expect(
			tab.containerEl.querySelector(".conflict-resolution-buttons") ||
				tab.containerEl.querySelector("div")
		).not.toBeNull();
	});

	test("no desktop warning when FileSystemAdapter present", () => {
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		const tab = new TeamDocsSettingTab(app, plugin);
		tab.display();

		expect(tab.containerEl.querySelector("h2")).not.toBeNull();
	});

	test("AI provider inputs update settings and save", () => {
		const tab = new TeamDocsSettingTab(app, plugin);
		tab.display();

		const inputs = Array.from(
			tab.containerEl.querySelectorAll("input[type='text']")
		) as HTMLInputElement[];
		const findByPlaceholder = (ph: string) =>
			inputs.find((i) => i.placeholder === ph)!;

		findByPlaceholder("sk-...").value = "sk-test";
		findByPlaceholder("sk-...").dispatchEvent(new Event("input"));
		expect(plugin.settings.ai.openaiApiKey).toBe("sk-test");

		findByPlaceholder("sk-ant-...").value = "ant-key";
		findByPlaceholder("sk-ant-...").dispatchEvent(new Event("input"));
		expect(plugin.settings.ai.anthropicApiKey).toBe("ant-key");

		findByPlaceholder("http://localhost:11434").value = "http://host:1234";
		findByPlaceholder("http://localhost:11434").dispatchEvent(
			new Event("input")
		);
		expect(plugin.settings.ai.ollamaBaseUrl).toBe("http://host:1234");

		findByPlaceholder("llama3.2:3b, gemma3:9b").value = "a, b";
		findByPlaceholder("llama3.2:3b, gemma3:9b").dispatchEvent(
			new Event("input")
		);
		expect(plugin.settings.ai.ollamaComposeModels).toEqual(["a", "b"]);

		findByPlaceholder("llama3.2:3b, gemma3:4b").value = "c";
		findByPlaceholder("llama3.2:3b, gemma3:4b").dispatchEvent(
			new Event("input")
		);
		expect(plugin.settings.ai.ollamaChatModels).toEqual(["c"]);

		findByPlaceholder("AI...").value = "google";
		findByPlaceholder("AI...").dispatchEvent(new Event("input"));
		expect(plugin.settings.ai.googleApiKey).toBe("google");

		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	test("basic settings inputs update and numeric parsing works", () => {
		const tab = new TeamDocsSettingTab(app, plugin);
		tab.display();
		const inputs = Array.from(
			tab.containerEl.querySelectorAll("input[type='text']")
		) as HTMLInputElement[];
		const findByPlaceholder = (ph: string) =>
			inputs.find((i) => i.placeholder === ph)!;

		findByPlaceholder("TeamDocs").value = "NewDocs";
		findByPlaceholder("TeamDocs").dispatchEvent(new Event("input"));
		expect(plugin.settings.teamDocsPath).toBe("NewDocs");

		findByPlaceholder("https://github.com/user/team-docs.git").value =
			"https://g.com/r.git";
		findByPlaceholder("https://github.com/user/team-docs.git").dispatchEvent(
			new Event("input")
		);
		expect(plugin.settings.gitRemoteUrl).toBe("https://g.com/r.git");

		findByPlaceholder("John Doe").value = "Alice";
		findByPlaceholder("John Doe").dispatchEvent(new Event("input"));
		expect(plugin.settings.userName).toBe("Alice");

		findByPlaceholder("john@example.com").value = "a@b.com";
		findByPlaceholder("john@example.com").dispatchEvent(new Event("input"));
		expect(plugin.settings.userEmail).toBe("a@b.com");

		findByPlaceholder("10").value = "15";
		findByPlaceholder("10").dispatchEvent(new Event("input"));
		expect(plugin.settings.autoSyncInterval).toBe(15);

		findByPlaceholder("10").value = "abc";
		findByPlaceholder("10").dispatchEvent(new Event("input"));
		expect(plugin.settings.autoSyncInterval).toBe(0);
	});

	test("Add/Delete MCP server and switch transport fields", async () => {
		const tab = new TeamDocsSettingTab(app, plugin);
		tab.display();

		const addBtn = Array.from(tab.containerEl.querySelectorAll("button")).find(
			(b) => b.textContent === "Add Server"
		) as HTMLButtonElement;
		addBtn.click();
		expect(plugin.settings.mcpClients.length).toBe(1);

		const selects = Array.from(
			tab.containerEl.querySelectorAll("select")
		) as HTMLSelectElement[];
		const transportSelect = selects[0];
		transportSelect.value = "streamable-http";
		transportSelect.dispatchEvent(new Event("change"));
		await Promise.resolve();
		expect(plugin.settings.mcpClients[0].transport.type).toBe("streamable-http");

		const urlInput = tab.containerEl.querySelector(
			"input[placeholder='http://localhost:8080/mcp']"
		) as HTMLInputElement;
		urlInput.value = "http://srv/mcp";
		urlInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.settings.mcpClients[0].transport.url).toBe("http://srv/mcp");

		transportSelect.value = "stdio";
		transportSelect.dispatchEvent(new Event("change"));
		const cmdInput = tab.containerEl.querySelector(
			"input[placeholder='node']"
		) as HTMLInputElement;
		cmdInput.value = "python";
		cmdInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.settings.mcpClients[0].transport.command).toBe("python");
		const argsInput = tab.containerEl.querySelector(
			"input[placeholder='/path/to/mcp/server.js']"
		) as HTMLInputElement;
		argsInput.value = "server.py";
		argsInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.settings.mcpClients[0].transport.args).toBe("server.py");

		const deleteBtn = Array.from(
			tab.containerEl.querySelectorAll("button")
		).find((b) => b.textContent === "Delete") as HTMLButtonElement;
		deleteBtn.click();
		await Promise.resolve();
		expect(plugin.settings.mcpClients.length).toBe(0);
		expect(plugin.mcpManager.refreshClients).toHaveBeenCalled();
	});
});
