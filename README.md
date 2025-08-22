# Team Docs Git Sync (Obsidian Plugin)

[🇧🇷 Versão em Português (Brasil)](README.pt-BR.md) | [🇦🇷 Versión en Español (Argentina)](README.es-AR.md)

## 📑 Index

- [Team Docs Git Sync (Obsidian Plugin)](#team-docs-git-sync-obsidian-plugin)
  - [📑 Index](#-index)
  - [Key Features](#key-features)
  - [How It Works](#how-it-works)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Configuration](#configuration)
    - [Git Settings](#git-settings)
    - [AI Provider Settings](#ai-provider-settings)
    - [MCP Server Settings](#mcp-server-settings)
    - [Context Management Settings](#context-management-settings)
  - [Typical Workflow](#typical-workflow)
    - [File Collaboration](#file-collaboration)
    - [AI-Assisted Document Work](#ai-assisted-document-work)
  - [AI Features](#ai-features)
    - [Chat Mode — Fluid Exploration](#chat-mode--fluid-exploration)
    - [Compose Mode — Comprehensive Analysis](#compose-mode--comprehensive-analysis)
    - [Write Mode — Targeted Editing](#write-mode--targeted-editing)
    - [Supported AI Providers](#supported-ai-providers)
  - [MCP Integration](#mcp-integration)
    - [What is MCP?](#what-is-mcp)
    - [Setting Up MCP Servers](#setting-up-mcp-servers)
    - [Using MCP Tools](#using-mcp-tools)
  - [Advanced Features](#advanced-features)
    - [Context Management](#context-management)
    - [Memory System](#memory-system)
    - [Planning Tools](#planning-tools)
    - [Similarity Search](#similarity-search)
  - [Handling Conflicts](#handling-conflicts)
  - [Limitations](#limitations)
  - [Security \& Privacy](#security--privacy)
  - [Troubleshooting](#troubleshooting)
  - [FAQ](#faq)
  - [License](#license)

---

Collaborate on Markdown notes with your team using **your own Git repository** as the sync backend — no paid sync services required.  
This Obsidian plugin adds lightweight collaboration features on top of Git, plus a powerful AI assistant with MCP (Model Context Protocol) integration for extended capabilities.

Key features include:

- Edit reservations and automatic commits
- Multi-provider AI assistant with advanced reasoning
- MCP integration for external tools and data sources
- Intelligent context management and memory
- Activity feed and conflict resolution helpers

It's **free**, **auditable**, and scales from personal use to mid-sized teams.

---

## Key Features

- **Git-based sync** — Works with GitHub, GitLab, Bitbucket, or self-hosted Git.
- **Edit reservations** — Prevents accidental overwrites by letting a user "reserve" a file for a limited time.
- **Auto-commit on change** — Automatically stages and commits edits after a short idle period.
- **Advanced AI assistant** — Multi-modal AI with reasoning display, context management, and memory.
- **MCP integration** — Connect to external Model Context Protocol servers for expanded capabilities.
- **Smart document operations** — Similarity search, link traversal, and Obsidian base file support.
- **Intelligent context management** — Automatic summarization, memory extraction, and planning.
- **Activity feed** — See recent team activity and reservation events.
- **Status indicator** — Live sync/conflict/error status in Obsidian's status bar.
- **Conflict helpers** — Guided resolution for merge conflicts and local changes.
- **Responsive design** — Modern UI that adapts to different screen sizes and mobile devices.
- **Flexible scope** — Choose between team-docs only or vault-wide AI operations.

---

## How It Works

- Your vault contains a subfolder (e.g., `Team/Docs`) as the shared **Team Docs root**.
- The plugin runs Git commands in that folder: fetch, pull, push, add, commit.
- Edit reservations are recorded via empty Git commits (e.g., `[RESERVE] path - user - timestamp`).
- On save/idle, the plugin auto-commits your changes and triggers a sync.
- If someone else has reserved a file, you'll be warned before editing.
- The AI assistant can search, analyze, and enhance your documentation using multiple providers and external tools.
- MCP servers extend AI capabilities with external data sources and specialized tools.

---

## Requirements

- **Obsidian Desktop** (Git CLI required — mobile support is limited).
- **Git installed** and available in your system PATH.
- **Writable Git remote** (GitHub, GitLab, Bitbucket, or self-hosted).
- **Optional**: API keys for AI providers (OpenAI, Anthropic, Google, or local Ollama).
- **Optional**: MCP servers for extended AI capabilities.

---

## Installation

**Recommended (Easy)**

1. Go to the **[Releases](https://github.com/lutefd/team-docs-syncer/releases/)** page of this repository.
2. Download the latest `.zip` file.
3. Extract it into your vault's `.obsidian/plugins/` folder:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```
4. Restart Obsidian and enable the plugin in **Settings → Community Plugins**.

**Development Install**

1. Clone this repo.
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Build for production:
   ```sh
   pnpm build
   ```
4. Copy or symlink the build output to:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```

---

## Configuration

Open the plugin's settings tab in Obsidian:

### Git Settings

- **Team Docs Folder** — Path inside your vault for shared docs (e.g., `Team/Docs`).
- **Git Remote URL** — Your repository's URL.
- **User Name / Email** — Used for Git commits and reservations.
- **Auto Sync on Startup** — Sync automatically when Obsidian launches.
- **Auto Sync Interval (min)** — Periodic sync interval (0 to disable).
- **Attachments Subdirectory** — Where pasted images are stored (e.g., `assets`).

### AI Provider Settings

- **OpenAI** — API key for GPT models (GPT-4o, GPT-4o-mini, o1-preview, o1-mini, etc.).
- **Anthropic** — API key for Claude models (Claude 3.5 Sonnet, Claude 3.5 Haiku, etc.).
- **Google** — API key for Gemini models (Gemini 2.0 Flash, Gemini 1.5 Pro, etc.).
- **Ollama** — Base URL and model list for local AI models.
- **Advanced Settings** — Temperature, max tokens, and other parameters.

### MCP Server Settings

- **Add MCP Servers** — Configure external Model Context Protocol servers.
- **Transport Types** — Support for STDIO, HTTP, and SSE connections.
- **Authentication** — Automatic OAuth flow handling for servers requiring authentication.
- **Connection Status** — Real-time monitoring of MCP server connections.

### Context Management Settings

- **AI Scope** — Choose between team-docs only or vault-wide operations.
- **Summarization** — Configure when conversations are automatically summarized.
- **Memory & Planning** — Settings for persistent memory and automatic planning.
- **Retrieval** — Configure document search and context retrieval parameters.

---

## Typical Workflow

### File Collaboration

1. Open a file under the Team Docs folder.
2. Start editing — the plugin will reserve the file for you.
3. Reservation auto-extends while you edit.
4. After idle, changes are auto-committed.
5. Use the Status Indicator to sync, check updates, or open the activity feed.

### AI-Assisted Document Work

- Open the **Chatbot View** from the ribbon or command palette.
- Select your AI provider, model, and optionally MCP servers.
- Ask questions, request summaries, or get document briefings.
- Use `[[filename]]` to reference and automatically attach specific files.
- Switch between **Chat**, **Compose**, and **Write** modes depending on your task.

---

## AI Features

The AI assistant offers three specialized modes:

### Chat Mode — Fluid Exploration

- Natural conversation about your documentation.
- Automatic context retrieval and memory integration.
- Support for file attachments and references.
- MCP tool integration for external data sources.
- Reasoning display in collapsible sections.

### Compose Mode — Comprehensive Analysis

- Deep analysis with automatic context gathering.
- Intelligent link traversal and document discovery.
- Automatic source citations with clickable links.
- Memory extraction and planning integration.
- Support for complex multi-step tasks.

### Write Mode — Targeted Editing

- Choose specific files to edit with focused context.
- AI proposes complete file edits with interactive diff review.
- Create new files with AI-generated content.
- Support for Obsidian base files and structured data.
- Edit proposals before applying changes.

### Supported AI Providers

- **OpenAI** — All text-based models including o1-preview with native reasoning.
- **Anthropic** — All Claude models with enhanced reasoning capabilities.
- **Google** — All Gemini models with long context support.
- **Ollama** — Local models like Llama, Gemma, and custom fine-tunes.

---

## MCP Integration

### What is MCP?

Model Context Protocol (MCP) allows AI assistants to connect to external tools and data sources. This plugin supports MCP servers to extend AI capabilities beyond your documentation.

### Setting Up MCP Servers

1. **Install MCP Servers** — Follow the documentation for your chosen MCP servers.
2. **Configure in Settings** — Add server configurations with appropriate transport types.
3. **Authentication** — The plugin handles OAuth flows automatically when required.
4. **Test Connections** — Verify server status in the MCP settings section.

### Using MCP Tools

- **Select Servers** — Choose which MCP servers to use in your chat sessions.
- **Automatic Integration** — AI automatically decides when to use MCP tools vs. internal tools.
- **Priority System** — MCP tools are preferred when they offer superior functionality.
- **Status Monitoring** — Real-time connection status and error handling.

Common MCP server types:

- **File Systems** — Access files outside your vault
- **Web APIs** — Search engines, databases, external services
- **Development Tools** — Git operations, code analysis, testing
- **Specialized Domains** — Scientific data, financial information, etc.

---

## Advanced Features

### Context Management

- **Automatic Summarization** — Long conversations are intelligently compressed.
- **Token Management** — Smart context pruning to stay within model limits.
- **Document Retrieval** — Relevant documents are automatically included in context.
- **Memory Integration** — Persistent facts and preferences are surfaced when relevant.

### Memory System

- **Fact Storage** — Important information is automatically extracted and stored.
- **Preferences** — User preferences and team conventions are remembered.
- **Entity Tracking** — People, projects, and important entities are tracked across sessions.
- **Session Persistence** — Memory persists across chat sessions and plugin restarts.

### Planning Tools

- **Automatic Planning** — Complex tasks trigger automatic plan generation.
- **Scratchpad** — Session-specific planning and progress tracking.
- **Next Steps** — AI suggests follow-up actions after completing tasks.
- **Progress Tracking** — Plans are updated as work progresses.

### Similarity Search

- **Document Similarity** — Find documents similar to a seed file using tags and content.
- **Multi-seed Search** — Find documents similar to multiple seed files.
- **Base File Generation** — Automatic generation of Obsidian base files for search results.
- **Link Analysis** — Traverse document links and analyze connections.

---

## Handling Conflicts

- Local changes that would be overwritten trigger a modal:
  - **Commit & Sync**
  - **Stash & Sync**
  - **Discard & Sync**
- Merge conflicts open a resolution modal with strategy options.
- AI-proposed changes are always reviewed via an interactive diff.

---

## Limitations

- Not real-time — sync is Git-based and periodic.
- Edit reservations are cooperative, not enforced.
- Desktop only (mobile limited by Git CLI).
- Large binary files or huge repos may slow performance.
- AI features require internet and valid API keys (except Ollama).
- MCP servers require external setup and maintenance.

---

## Security & Privacy

- Your notes stay in **your repository** — no third-party servers beyond your Git host.
- AI providers process content per their privacy policies.
- Ollama runs locally and keeps all data on your machine.
- MCP servers may have their own privacy implications — review their documentation.
- Avoid committing secrets — use `.gitignore`.
- AI chat history, memory, and planning data are stored locally.
- OAuth flows are handled securely with automatic cleanup.

---

## Troubleshooting

- Ensure Git is installed and in PATH.
- Verify remote URL and credentials.
- Check AI provider API keys and connectivity.
- For Ollama, ensure the service is running and models are available.
- For MCP servers, verify configuration and check connection status.
- Check the console for Git, AI, or MCP errors.
- Clear plugin data if experiencing persistent issues.

---

## FAQ

**Why Git instead of real-time sync?**  
Git is free, ubiquitous, and works offline. This plugin makes it practical for teams already using Git.

**Can two users edit the same file?**  
Yes, but the reservation system reduces conflicts. Conflicts can still happen and must be resolved.

**Does this replace paid sync services?**  
For many teams, yes. For real-time collaboration, a dedicated sync service may be better.

**What are MCP servers and do I need them?**  
MCP servers extend AI capabilities with external tools and data. They're optional but can greatly enhance functionality for specific use cases.

**Can I use multiple AI providers and MCP servers?**  
Yes — configure multiple providers and servers, then select which to use for each conversation.

**Is my data sent to AI providers?**  
Only when using cloud providers. Ollama keeps everything local. MCP servers depend on their implementation.

**How does the memory system work?**  
The AI automatically extracts important facts, preferences, and decisions from conversations and stores them locally for future reference.

---

## License

MIT © 2025 Luis Dourado
