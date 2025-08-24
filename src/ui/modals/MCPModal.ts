import { Modal } from "obsidian";
import TeamDocsPlugin from "../../../main";

export interface MCPSelection {
	clientIds: string[];
}

export interface MCPModalOptions {
	onSelectionChange?: (selection: MCPSelection) => void;
	initialSelection?: MCPSelection;
}

export class MCPModal extends Modal {
	private plugin: TeamDocsPlugin;
	private options: MCPModalOptions;
	private selectedClientIds: Set<string> = new Set();

	constructor(plugin: TeamDocsPlugin, options: MCPModalOptions = {}) {
		super(plugin.app);
		this.plugin = plugin;
		this.options = options;

		if (options.initialSelection?.clientIds) {
			this.selectedClientIds = new Set(options.initialSelection.clientIds);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mcp-modal");
		this.modalEl.addClass("mcp-modal-fullscreen");

		contentEl.createEl("h2", { text: "Select MCP Servers" });

		contentEl.createEl("p", {
			text: "Choose which MCP servers to include in your chat session. Selected servers will provide additional tools and capabilities.",
			cls: "mcp-modal-description",
		});

		const clientsContainer = contentEl.createDiv({
			cls: "mcp-clients-container",
		});

		this.renderMCPClients(clientsContainer);

		const buttonContainer = contentEl.createDiv({ cls: "mcp-modal-buttons" });

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "mod-cta",
		});
		cancelBtn.onclick = () => this.close();

		const applyBtn = buttonContainer.createEl("button", {
			text: "Apply Selection",
			cls: "mod-cta",
		});
		applyBtn.onclick = () => {
			if (this.options.onSelectionChange) {
				this.options.onSelectionChange({
					clientIds: Array.from(this.selectedClientIds),
				});
			}
			this.close();
		};
	}

	private renderMCPClients(container: HTMLElement) {
		container.empty();

		const mcpClients = this.plugin.settings.mcpClients || [];

		if (mcpClients.length === 0) {
			container.createEl("p", {
				text: "No MCP servers configured. Add servers in plugin settings.",
				cls: "mcp-no-clients",
			});
			return;
		}

		const clientStatuses = this.plugin.mcpManager.getClientStatus();
		const statusMap = new Map(
			clientStatuses.map((status) => [status.id, status])
		);

		mcpClients.forEach((client) => {
			if (!client.enabled) return;

			const clientEl = container.createDiv({ cls: "mcp-client-item" });

			const checkboxContainer = clientEl.createDiv({
				cls: "mcp-client-checkbox-container",
			});

			const checkbox = checkboxContainer.createEl("input", {
				type: "checkbox",
				cls: "mcp-client-checkbox",
			}) as HTMLInputElement;

			checkbox.checked = this.selectedClientIds.has(client.id);
			checkbox.onchange = () => {
				if (checkbox.checked) {
					this.selectedClientIds.add(client.id);
				} else {
					this.selectedClientIds.delete(client.id);
				}
			};

			const labelContainer = checkboxContainer.createDiv({
				cls: "mcp-client-label-container",
			});

			const nameEl = labelContainer.createEl("span", {
				text: client.name,
				cls: "mcp-client-name",
			});

			const status = statusMap.get(client.id);
			const statusEl = labelContainer.createEl("span", {
				cls: "mcp-client-status",
			});

			if (status) {
				if (status.connected) {
					statusEl.textContent = "Connected";
					statusEl.addClass("status-connected");
				} else if (status.lastError) {
					statusEl.textContent = "Error";
					statusEl.addClass("status-error");
					statusEl.title = status.lastError;
				} else {
					statusEl.textContent = "Disconnected";
					statusEl.addClass("status-disconnected");
				}
			} else {
				statusEl.textContent = "Not Found";
				statusEl.addClass("status-not-found");
			}

			const transportEl = clientEl.createDiv({ cls: "mcp-client-transport" });
			transportEl.textContent = `Transport: ${client.transport.type}`;

			if (!status?.connected) {
				checkbox.disabled = true;
				clientEl.addClass("mcp-client-disabled");
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
