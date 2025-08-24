import { PathUtils } from "../../src/utils/PathUtils";

describe("PathUtils", () => {
	beforeEach(() => {
		PathUtils.setAiScope("team-docs");
	});

	describe("AI scope", () => {
		test("get/set scope and isWithinAiScope behavior", () => {
			expect(PathUtils.getAiScope()).toBe("team-docs");
			expect(PathUtils.isWithinAiScope("Team/Docs/a.md", "Team/Docs")).toBe(
				true
			);
			expect(PathUtils.isWithinAiScope("Outside/a.md", "Team/Docs")).toBe(
				false
			);

			PathUtils.setAiScope("vault-wide");
			expect(PathUtils.getAiScope()).toBe("vault-wide");
			expect(PathUtils.isWithinAiScope("Outside/a.md", "Team/Docs")).toBe(true);
		});

		test("getInteractablePath returns root for vault-wide and teamDocsPath otherwise", () => {
			expect(PathUtils.getInteractablePath("Team/Docs")).toBe("Team/Docs");
			PathUtils.setAiScope("vault-wide");
			expect(PathUtils.getInteractablePath("Team/Docs")).toBe("/");
		});
	});

	describe("cleanGitPath", () => {
		test("removes current team path prefix exactly", () => {
			expect(PathUtils.cleanGitPath("TeamDocs/docs/file.md", "TeamDocs")).toBe(
				"docs/file.md"
			);
		});

		test("removes up to two team-like prefixes based on heuristics", () => {
			expect(
				PathUtils.cleanGitPath("OtherUserTeam/Docs/file.md", "MyTeam")
			).toBe("file.md");
		});

		test("stops when first segment is not team-like", () => {
			expect(PathUtils.cleanGitPath("src/docs/file.md", "MyTeam")).toBe(
				"src/docs/file.md"
			);
		});
	});

	describe("relative/absolute conversion", () => {
		test("toRelativePath returns relative when inside, null when outside", () => {
			expect(
				PathUtils.toRelativePath("/abs/Team/Docs/a.md", "/abs/Team/Docs")
			).toBe("a.md");
			expect(
				PathUtils.toRelativePath("/abs/Team/DocsDeep/a.md", "/abs/Team/Docs")
			).toBeNull();
		});

		test("toAbsolutePath joins with slash", () => {
			expect(PathUtils.toAbsolutePath("a/b.md", "/root/Docs")).toBe(
				"/root/Docs/a/b.md"
			);
		});
	});

	describe("normalizePath", () => {
		test("normalizes leading/trailing slashes, duplicate slashes, ./ and .. segments (single pass)", () => {
			expect(PathUtils.normalizePath("/a//b/./c/")).toBe("a/b/c");
			expect(PathUtils.normalizePath("/a/b/../c/")).toBe("a/c");
			expect(PathUtils.normalizePath("/x/y/../z/../w/")).toBe("x/z/../w");
		});
	});

	describe("team docs helpers", () => {
		test("isWithinTeamDocs respects exact folder prefix with slash", () => {
			expect(PathUtils.isWithinTeamDocs("Team/Docs/a.md", "Team/Docs")).toBe(
				true
			);
			expect(PathUtils.isWithinTeamDocs("Team/DocsX/a.md", "Team/Docs")).toBe(
				false
			);
		});

		test("getFileName and getDirectoryPath", () => {
			expect(PathUtils.getFileName("Team/Docs/a.md")).toBe("a.md");
			expect(PathUtils.getFileName("no/slash/ending/")).toBe("");
			expect(PathUtils.getDirectoryPath("Team/Docs/a.md")).toBe("Team/Docs");
			expect(PathUtils.getDirectoryPath("single")).toBe("");
		});
	});
});
