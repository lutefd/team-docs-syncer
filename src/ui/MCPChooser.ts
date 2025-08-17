import { Component } from "obsidian";
import { MCPClientConfig } from "../types/Settings";
import { MCPManager } from "../managers/MCPManager";
import TeamDocsPlugin from "../../main";

export interface MCPSelection {
	clientIds: string[];
}

export interface MCPChooserOptions {
	plugin: TeamDocsPlugin;
	onSelectionChange: (selection: MCPSelection) => void;
	initialSelection?: MCPSelection;
}

/**
 * MCP server chooser UI component for selecting which MCP servers to use
 */
export class MCPChooser extends Component {
	private containerEl: HTMLElement;
	private checkboxContainer: HTMLElement;
	private statusEl: HTMLElement;
	private selectedClientIds: Set<string> = new Set();

	constructor(containerEl: HTMLElement, private options: MCPChooserOptions) {
		super();
		this.containerEl = containerEl;

		if (options.initialSelection) {
			this.selectedClientIds = new Set(options.initialSelection.clientIds);
		}

		this.render();
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("mcp-chooser");

		const headerEl = this.containerEl.createDiv("mcp-chooser-header");
		headerEl.createEl("label", {
			text: "MCP Servers:",
			cls: "mcp-label",
		});

		this.checkboxContainer = this.containerEl.createDiv("mcp-checkboxes");
		this.statusEl = this.containerEl.createDiv("mcp-status");

		this.populateServers();
		this.updateStatus();
	}

	private populateServers() {
		this.checkboxContainer.empty();

		const availableClients = this.options.plugin.settings.mcpClients.filter(
			(client) => client.enabled
		);

		if (availableClients.length === 0) {
			const noServersEl = this.checkboxContainer.createDiv("no-mcp-servers");
			noServersEl.textContent = "No MCP servers configured";
			noServersEl.style.color = "var(--text-muted)";
			noServersEl.style.fontStyle = "italic";
			return;
		}

		availableClients.forEach((client) => {
			const checkboxWrapper = this.checkboxContainer.createDiv(
				"mcp-checkbox-wrapper"
			);

			const checkbox = checkboxWrapper.createEl("input", {
				type: "checkbox",
				cls: "mcp-checkbox",
			}) as HTMLInputElement;

			checkbox.id = `mcp-${client.id}`;
			checkbox.checked = this.selectedClientIds.has(client.id);

			const label = checkboxWrapper.createEl("label", {
				text: client.name || `MCP Server ${client.id}`,
				cls: "mcp-checkbox-label",
			});
			label.setAttribute("for", checkbox.id);

			const statusIndicator = label.createSpan("mcp-connection-status");
			this.updateConnectionStatus(statusIndicator, client.id);

			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedClientIds.add(client.id);
				} else {
					this.selectedClientIds.delete(client.id);
				}
				this.onSelectionChange();
			});
		});
	}

	private async updateConnectionStatus(
		statusEl: HTMLElement,
		clientId: string
	) {
		const mcpManager = this.options.plugin.mcpManager;
		if (!mcpManager) {
			statusEl.textContent = " (Not initialized)";
			statusEl.style.color = "var(--text-muted)";
			return;
		}

		const client = mcpManager.getClient(clientId);
		if (!client) {
			statusEl.textContent = " (Not found)";
			statusEl.style.color = "var(--text-error)";
			return;
		}

		if (client.connected) {
			statusEl.textContent = " ✅";
			statusEl.style.color = "var(--text-success)";
		} else {
			statusEl.textContent = " ❌";
			statusEl.style.color = "var(--text-error)";
			if (client.lastError) {
				statusEl.title = `Error: ${client.lastError}`;
			}
		}
	}

	private onSelectionChange() {
		const selection: MCPSelection = {
			clientIds: Array.from(this.selectedClientIds),
		};

		this.updateStatus();
		this.options.onSelectionChange(selection);
	}

	private updateStatus() {
		this.statusEl.empty();

		const selectedCount = this.selectedClientIds.size;
		const availableCount = this.options.plugin.settings.mcpClients.filter(
			(client) => client.enabled
		).length;

		if (selectedCount === 0) {
			this.statusEl.createSpan({
				text: "No MCP servers selected",
				cls: "mcp-status-none",
			});
		} else {
			this.statusEl.createSpan({
				text: `${selectedCount}/${availableCount} servers selected`,
				cls: "mcp-status-selected",
			});
		}
	}

	public setSelection(selection: MCPSelection) {
		this.selectedClientIds = new Set(selection.clientIds);
		this.populateServers();
		this.updateStatus();
		this.options.onSelectionChange(selection);
	}

	public getSelection(): MCPSelection {
		return {
			clientIds: Array.from(this.selectedClientIds),
		};
	}

	public refresh() {
		const currentSelection = this.getSelection();
		this.populateServers();
		this.setSelection(currentSelection);
	}

	/**
	 * Select all available MCP servers
	 */
	public selectAll() {
		const availableClientIds = this.options.plugin.settings.mcpClients
			.filter((client) => client.enabled)
			.map((client) => client.id);

		this.setSelection({ clientIds: availableClientIds });
	}

	/**
	 * Deselect all MCP servers
	 */
	public selectNone() {
		this.setSelection({ clientIds: [] });
	}
}
