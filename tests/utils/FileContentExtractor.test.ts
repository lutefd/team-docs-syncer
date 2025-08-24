import { createMockApp } from "../helpers/mockPlugin";
import type { App } from "obsidian";

describe("FileContentExtractor", () => {
	let FileContentExtractor: any;
	let extractor: any;
	let app: App;
	let TFileRef: any;

	const makeTFile = (path: string, content: string = "") => {
		const obj: any = Object.create((TFileRef as any).prototype);
		obj.path = path;
		obj.name = path.split("/").pop() ?? path;
		obj.basename = obj.name.replace(/\.md$/i, "");
		(obj as any).__content = content;
		return obj;
	};

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({
			FileContentExtractor,
		} = require("../../src/utils/FileContentExtractor"));
		TFileRef = require("obsidian").TFile;

		app = createMockApp();
		(app as any).vault.getAbstractFileByPath = jest.fn(() => null);
		(app as any).vault.getMarkdownFiles = jest.fn(() => []);
		(app as any).vault.read = jest.fn(async (f: any) => f.__content ?? "");

		extractor = new FileContentExtractor(app);
	});

	describe("extractWikiLinks", () => {
		test("extracts links with and without display names, trims, includes fullMatch", () => {
			const text =
				"See [[Docs/A.md]] and [[B.md|Display B]] plus [[ C.md | Cdisp ]]";
			const links = extractor.extractWikiLinks(text);
			expect(links).toEqual([
				{
					path: "Docs/A.md",
					displayName: undefined,
					fullMatch: "[[Docs/A.md]]",
				},
				{
					path: "B.md",
					displayName: "Display B",
					fullMatch: "[[B.md|Display B]]",
				},
				{ path: "C.md", displayName: "Cdisp", fullMatch: "[[ C.md | Cdisp ]]" },
			]);
		});
	});

	describe("getFileContent", () => {
		test("returns content when getAbstractFileByPath resolves a TFile", async () => {
			const file = makeTFile("Team/Docs/A.md", "CONTENT-A");
			(app as any).vault.getAbstractFileByPath = jest.fn(() => file);
			const out = await extractor.getFileContent("Team/Docs/A.md");
			expect(out).toBe("CONTENT-A");
		});

		test("searches by various name/path heuristics when not a TFile", async () => {
			const a = makeTFile("Team/Docs/A.md", "A");
			const b = makeTFile("Team/Other/NoteB.md", "B");
			(app as any).vault.getMarkdownFiles = jest.fn(() => [a, b]);

			expect(await extractor.getFileContent("A")).toBe("A");
			expect(await extractor.getFileContent("NoteB.md")).toBe("B");
			expect(await extractor.getFileContent("Team/Other/NoteB.md")).toBe("B");
			expect(await extractor.getFileContent("Other/NoteB")).toBe("B");
		});

		test("returns null when nothing matches or read throws", async () => {
			(app as any).vault.getMarkdownFiles = jest.fn(() => []);
			expect(await extractor.getFileContent("Nope.md")).toBeNull();

			const c = makeTFile("C.md", "C");
			(app as any).vault.getMarkdownFiles = jest.fn(() => [c]);
			(app as any).vault.read = jest.fn(async () => {
				throw new Error("boom");
			});
			expect(await extractor.getFileContent("C.md")).toBeNull();
		});
	});

	describe("processTextWithAttachments", () => {
		test("returns original text when no links", async () => {
			const text = "No links here";
			const out = await extractor.processTextWithAttachments(text);
			expect(out).toBe(text);
		});

		test("appends attachedcontent blocks for found links, respects displayName and path fallback", async () => {
			const a = makeTFile("Team/Docs/A.md", "AAA");
			const b = makeTFile("Team/Docs/B.md", "BBB\nLine2");
			(app as any).vault.getAbstractFileByPath = jest.fn(
				(p: string) => (({ [a.path]: a, [b.path]: b } as any)[p] || null)
			);

			const text = "Intro [[Team/Docs/A.md|Alpha]] and [[Team/Docs/B.md]] end.";
			const out = await extractor.processTextWithAttachments(text);

			expect(out).toContain(text + "\n\n");
			expect(out).toContain(
				'<attachedcontent file="Alpha" path="Team/Docs/A.md">'
			);
			expect(out).toContain("AAA\n</attachedcontent>");
			expect(out).toContain(
				'<attachedcontent file="B.md" path="Team/Docs/B.md">'
			);
			expect(out).toContain("BBB\nLine2\n</attachedcontent>");
		});

		test("skips attachments when content is null", async () => {
			(app as any).vault.getAbstractFileByPath = jest.fn(() => null);
			const text = "Intro [[Team/Docs/Missing.md]] end";
			const out = await extractor.processTextWithAttachments(text);
			expect(out).toBe(text);
		});
	});
});
