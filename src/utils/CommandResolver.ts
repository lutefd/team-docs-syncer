import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class CommandResolver {
	async resolveCommandPath(command: string): Promise<string> {
		if (command.startsWith("/")) {
			return command;
		}

		if (command === "npx") {
			const nodePath = await this.resolveCommandPath("node");
			const npxPath = nodePath.replace("/node", "/npx");

			try {
				const fs = require("fs");
				if (fs.existsSync(npxPath)) {
					return npxPath;
				}
			} catch (e) {}
		}

		if (command === "node") {
			const resolved = await this.resolveNodePath();
			if (resolved) return resolved;
		}

		try {
			const { stdout } = await execAsync(`which ${command}`, { timeout: 5000 });
			const resolvedPath = stdout.trim();
			if (resolvedPath && resolvedPath !== command) {
				return resolvedPath;
			}
		} catch (e) {}

		const resolved = this.tryCommonPaths(command);
		if (resolved) return resolved;

		return command;
	}

	private async resolveNodePath(): Promise<string | null> {
		const fnmPaths = [
			`${process.env.HOME}/.local/state/fnm_multishells`,
			`${process.env.HOME}/.fnm`,
		];

		for (const fnmBase of fnmPaths) {
			const nodePath = await this.tryFnmPath(fnmBase);
			if (nodePath) return nodePath;
		}

		const nvmPath = `${process.env.HOME}/.nvm/current/bin/node`;
		if (this.isExecutable(nvmPath)) {
			return nvmPath;
		}

		return null;
	}

	private async tryFnmPath(fnmBase: string): Promise<string | null> {
		try {
			const fs = require("fs");
			if (fs.existsSync(fnmBase)) {
				const dirs = fs.readdirSync(fnmBase);
				for (const dir of dirs) {
					const nodePath = `${fnmBase}/${dir}/bin/node`;
					if (this.isExecutable(nodePath)) {
						return nodePath;
					}
				}
			}
		} catch (e) {}
		return null;
	}

	private tryCommonPaths(command: string): string | null {
		const commonPaths: Record<string, string[]> = {
			node: [
				"/usr/local/bin/node",
				"/opt/homebrew/bin/node",
				"/usr/bin/node",
				"/usr/local/opt/node/bin/node",
			],
			python: [
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/usr/bin/python3",
				"/usr/local/opt/python/bin/python3",
			],
			python3: [
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/usr/bin/python3",
				"/usr/local/opt/python/bin/python3",
			],
		};

		const pathsToTry = commonPaths[command];
		if (pathsToTry) {
			for (const path of pathsToTry) {
				if (this.isExecutable(path)) {
					return path;
				}
			}
		}

		return null;
	}

	private isExecutable(path: string): boolean {
		try {
			const fs = require("fs");
			return fs.existsSync(path) && fs.statSync(path).mode & parseInt("111", 8);
		} catch (e) {
			return false;
		}
	}
}
