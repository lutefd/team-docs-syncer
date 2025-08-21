import type TeamDocsPlugin from "../../main";
import { createFileOperationTools } from "./obsidian/fileOperations";
import { createSearchOperationTools } from "./obsidian/searchOperations";
import { createLinkOperationTools } from "./navigation/linkOperations";
import { createBasesOperationTools } from "./obsidian/basesOperations";

export function buildTools(plugin: TeamDocsPlugin) {
	return {
		...createFileOperationTools(plugin),
		...createSearchOperationTools(plugin),
		...createLinkOperationTools(plugin),
		...createBasesOperationTools(plugin),
	} as const;
}
