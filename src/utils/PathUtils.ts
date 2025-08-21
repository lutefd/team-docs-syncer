import TeamDocsPlugin from "main";

/**
 * Utility functions for handling file paths in team docs syncing
 */
export class PathUtils {
	/**
	 * Configuration for scope handling - can be extended for vault-wide features
	 */
	private static scopeConfig: {
		aiFeatures: "team-docs" | "vault-wide";
		reservations: "team-docs";
	} = {
		aiFeatures: "team-docs",
		reservations: "team-docs",
	};

	/**
	 * Sets the scope for AI features
	 * @param scope - 'team-docs' or 'vault-wide'
	 */
	static setAiScope(scope: "team-docs" | "vault-wide"): void {
		PathUtils.scopeConfig.aiFeatures = scope;
	}

	/**
	 * Gets the current AI scope
	 */
	static getAiScope(): "team-docs" | "vault-wide" {
		return PathUtils.scopeConfig.aiFeatures;
	}

	/**
	 *  Gets Interactable Path depending on the scope
	 */
	static getInteractablePath(teamDocsPath: string): string {
		const scope = PathUtils.getAiScope();
		if (scope === "vault-wide") {
			return "/";
		}
		return teamDocsPath;
	}

	/**
	 * Cleans a Git commit path by removing other users' team folder prefixes
	 * Git stores paths relative to repo root, which may include other users' team folders
	 * @param gitPath - Path from Git commit (e.g., "otherUserFolder/docs/file.md")
	 * @param currentTeamPath - Current user's team docs folder name
	 * @returns Cleaned path relative to team docs (e.g., "docs/file.md")
	 */
	static cleanGitPath(gitPath: string, currentTeamPath: string): string {
		let pathParts = gitPath.split("/");
		let removedCount = 0;

		while (pathParts.length > 1 && removedCount < 2) {
			const firstPart = pathParts[0];

			if (firstPart === currentTeamPath) {
				pathParts = pathParts.slice(1);
				break;
			}

			const looksLikeTeamFolder =
				removedCount === 0
					? firstPart.length > 3 &&
					  (firstPart.toLowerCase().includes("team") ||
							firstPart.toLowerCase().includes("docs") ||
							/^[a-z]+[A-Z]/.test(firstPart) ||
							/^[A-Z][a-zA-Z]*$/.test(firstPart))
					: firstPart.toLowerCase().includes("team") ||
					  firstPart.toLowerCase().includes("docs");

			if (looksLikeTeamFolder) {
				pathParts = pathParts.slice(1);
				removedCount++;
			} else {
				break;
			}
		}

		const result = pathParts.join("/");
		return result;
	}

	/**
	 * Checks if a file is within the AI operation scope
	 * @param filePath - The file path to check
	 * @param teamDocsPath - The team docs folder path
	 * @returns True if the file is within AI scope
	 */
	static isWithinAiScope(filePath: string, teamDocsPath: string): boolean {
		if (PathUtils.scopeConfig.aiFeatures === "vault-wide") {
			return true;
		}
		return PathUtils.isWithinTeamDocs(filePath, teamDocsPath);
	}
	/**
	 * Converts an absolute file path to a relative path within the team docs folder
	 * @param absolutePath - The absolute path to the file
	 * @param teamDocsPath - The absolute path to the team docs folder
	 * @returns The relative path from the team docs root, or null if not within team docs
	 */
	static toRelativePath(
		absolutePath: string,
		teamDocsPath: string
	): string | null {
		if (!absolutePath.startsWith(teamDocsPath + "/")) {
			return null;
		}
		return absolutePath.substring(teamDocsPath.length + 1);
	}

	/**
	 * Converts a relative path to an absolute path within the team docs folder
	 * @param relativePath - The relative path from team docs root
	 * @param teamDocsPath - The absolute path to the team docs folder
	 * @returns The absolute path to the file
	 */
	static toAbsolutePath(relativePath: string, teamDocsPath: string): string {
		return `${teamDocsPath}/${relativePath}`;
	}

	/**
	 * Normalizes a path by removing leading/trailing slashes and resolving relative segments
	 * @param path - The path to normalize
	 * @returns The normalized path
	 */
	static normalizePath(path: string): string {
		return path
			.replace(/^\/+|\/+$/g, "")
			.replace(/\/+/g, "/")
			.replace(/\/\.\//g, "/")
			.replace(/\/[^\/]+\/\.\.\//g, "/");
	}

	/**
	 * Checks if a file path is within the team docs folder
	 * @param filePath - The file path to check
	 * @param teamDocsPath - The team docs folder path
	 * @returns True if the file is within team docs
	 */
	static isWithinTeamDocs(filePath: string, teamDocsPath: string): boolean {
		return filePath.startsWith(teamDocsPath + "/");
	}

	/**
	 * Extracts the filename from a path
	 * @param path - The file path
	 * @returns The filename with extension
	 */
	static getFileName(path: string): string {
		return path.split("/").pop() || "";
	}

	/**
	 * Gets the directory path from a file path
	 * @param path - The file path
	 * @returns The directory path
	 */
	static getDirectoryPath(path: string): string {
		const parts = path.split("/");
		parts.pop();
		return parts.join("/");
	}
}
