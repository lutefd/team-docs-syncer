import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

jest.mock("ai", () => ({ tool: (def: any) => def }));

describe("buildTools aggregator", () => {
	let app: App;
	let plugin: any;
	let buildTools: any;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ buildTools } = require("../../src/tools/index"));
		app = createMockApp();
		plugin = createMockPlugin(app);
		(plugin.app as any).metadataCache = (plugin.app as any).metadataCache || {
			getFileCache: jest.fn(() => ({ tags: [], frontmatter: {} })),
		};
		(plugin.app as any).vault.getAbstractFileByPath = jest.fn(() => null);
	});

	test("returns all expected tool entries with execute", () => {
		const tools = buildTools(plugin);

		const expected = [
			// fileOperations
			"read_doc",
			"propose_edit",
			"create_doc",
			"list_docs",
			// searchOperations
			"search_docs",
			"search_tags",
			"search_similar",
			"find_similar_to_doc",
			"find_similar_to_many",
			// navigation/linkOperations
			"follow_links",
			"get_backlinks",
			"get_graph_context",
			// basesOperations
			"create_base",
			"search_base_def",
			// planningTools
			"planning_read",
			"planning_update_section",
			"planning_replace",
			"planning_write",
			"memories_add",
			"memories_list",
		];

		for (const key of expected) {
			expect(tools).toHaveProperty(key);
			const tool = (tools as any)[key];
			expect(tool && typeof tool.execute).toBe("function");
			expect(typeof tool.description).toBe("string");
		}

		const keys = Object.keys(tools);
		expect(new Set(keys).size).toBe(keys.length);
		expect(expected.every((k) => keys.includes(k))).toBe(true);
	});
});
