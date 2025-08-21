import { PathUtils } from "src/utils/PathUtils";

export const withRetry = async <T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	delay: number = 1000
): Promise<T> => {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			if (attempt === maxRetries) {
				throw error;
			}
			console.warn(
				`Tool operation failed (attempt ${attempt}/${maxRetries}):`,
				error
			);
			await new Promise((resolve) => setTimeout(resolve, delay * attempt));
		}
	}
	throw new Error("Retry logic failed unexpectedly");
};

export const cleanAndResolvePath = (path: string, teamRoot: string): string => {
	let cleanPath = path;
	const wikiLinkMatch = path.match(/^\[\[([^\]]+)\]\]$/);
	if (wikiLinkMatch) {
		cleanPath = wikiLinkMatch[1];
		if (!cleanPath.endsWith(".md")) {
			cleanPath += ".md";
		}
		if (!PathUtils.isWithinAiScope(cleanPath, teamRoot)) {
			cleanPath = teamRoot + "/" + cleanPath;
		}
	}
	return cleanPath;
};
