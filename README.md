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
  - [Typical Workflow](#typical-workflow)
    - [File Collaboration](#file-collaboration)
    - [AI-Assisted Document Work](#ai-assisted-document-work)
  - [AI Features](#ai-features)
    - [Chat Mode — Fluid Exploration](#chat-mode--fluid-exploration)
    - [Write Mode — Targeted Editing](#write-mode--targeted-editing)
    - [Supported AI Providers](#supported-ai-providers)
  - [Handling Conflicts](#handling-conflicts)
  - [Limitations](#limitations)
  - [Security \& Privacy](#security--privacy)
  - [Troubleshooting](#troubleshooting)
  - [FAQ](#faq)
  - [License](#license)

---

Collaborate on Markdown notes with your team using **your own Git repository** as the sync backend — no paid sync services required.  
This Obsidian plugin adds lightweight collaboration features on top of Git, including:

- Edit reservations
- Automatic commits
- Conflict helpers
- An AI-powered document assistant
- An activity feed

It’s **free**, **auditable**, and works well for small to mid-sized teams comfortable with Git.

---

## Key Features

- **Git-based sync** — Works with GitHub, GitLab, Bitbucket, or self-hosted Git.
- **Edit reservations** — Prevents accidental overwrites by letting a user “reserve” a file for a limited time.
- **Auto-commit on change** — Automatically stages and commits edits after a short idle period.
- **AI-powered document assistant** — Search, summarize, and brief your team docs like a self-updating NotebookLM, powered by multiple AI providers.
- **Smart file operations** — AI can propose edits, create new files, and help with content generation.
- **Activity feed** — See recent team activity and reservation events.
- **Status indicator** — Live sync/conflict/error status in Obsidian’s status bar.
- **Conflict helpers** — Guided resolution for merge conflicts and local changes.
- **Responsive design** — Modern UI that adapts to different screen sizes.
- **Configurable** — Choose your team docs folder, remote URL, AI providers, and more.

---

## How It Works

- Your vault contains a subfolder (e.g., `Team/Docs`) as the shared **Team Docs root**.
- The plugin runs Git commands in that folder: fetch, pull, push, add, commit.
- Edit reservations are recorded via empty Git commits (e.g., `[RESERVE] path - user - timestamp`).
- On save/idle, the plugin auto-commits your changes and triggers a sync.
- If someone else has reserved a file, you’ll be warned before editing.
- The AI assistant can search, read, and summarize your team docs using various AI providers.

---

## Requirements

- **Obsidian Desktop** (Git CLI required — mobile support is limited).
- **Git installed** and available in your system PATH.
- **Writable Git remote** (GitHub, GitLab, Bitbucket, or self-hosted).
- **Optional**: API keys for AI providers (OpenAI, Anthropic, Google, or local Ollama).

---

## Installation

**Recommended (Easy)**

1. Go to the **[Releases](./releases)** page of this repository.
2. Download the latest `.zip` file.
3. Extract it into your vault’s `.obsidian/plugins/` folder:
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

Open the plugin’s settings tab in Obsidian:

### Git Settings

- **Team Docs Folder** — Path inside your vault for shared docs (e.g., `Team/Docs`).
- **Git Remote URL** — Your repository’s URL.
- **User Name / Email** — Used for Git commits and reservations.
- **Auto Sync on Startup** — Sync automatically when Obsidian launches.
- **Auto Sync Interval (min)** — Periodic sync interval (0 to disable).
- **Attachments Subdirectory** — Where pasted images are stored (e.g., `assets`).

### AI Provider Settings

- **OpenAI** — API key for GPT models (latest GPT‑5, GPT‑4o, GPT‑4o-mini, etc.).
- **Anthropic** — API key for Claude models (Claude 4 Sonnet, Haiku, Opus).
- **Google** — API key for Gemini models (Gemini 2.5 Pro, Gemini 1.5 Flash, etc.).
- **Ollama** — Base URL and model list for local AI models.
- **Advanced Settings** — Temperature, max tokens, and other parameters.

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
- Select your AI provider and model.
- Ask questions, request summaries, or get document briefings.
- Use `@filename` to reference specific files.
- Switch between **Chat Mode** (fluid exploration) and **Write Mode** (targeted editing) depending on your task.

---

## AI Features

Both modes share the same AI tools through the **composer**, but differ in focus:

### Chat Mode — Fluid Exploration

- Search and read relevant files to answer questions.
- Summarize and brief entire sections of your docs.
- Automatically follow links between notes to uncover related context you might not know exists.
- Traverse your directory structure to find deeper connections.
- Automatic source citations with clickable links.
- Pin files to focus AI attention.

### Write Mode — Targeted Editing

- Choose specific files to edit, reducing token usage and speeding up processing.
- Request content creation or modifications for selected files.
- AI proposes complete file edits with an interactive diff review.
- Create new files with AI-generated content.
- Edit proposals before applying changes.

### Supported AI Providers

- **OpenAI** — Every text based model.
- **Anthropic** — Every text based model.
- **Google** — Every text based model.
- **Ollama** — Local models like Llama, Gemma, and custom fine-tunes.

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

---

## Security & Privacy

- Your notes stay in **your repository** — no third-party servers beyond your Git host.
- AI providers process content per their privacy policies.
- Ollama runs locally and keeps all data on your machine.
- Avoid committing secrets — use `.gitignore`.
- AI chat history is stored locally.

---

## Troubleshooting

- Ensure Git is installed and in PATH.
- Verify remote URL and credentials.
- Check AI provider API keys and connectivity.
- For Ollama, ensure the service is running and models are available.
- Check the console for Git or AI errors.

---

## FAQ

**Why Git instead of real-time sync?**  
Git is free, ubiquitous, and works offline. This plugin makes it practical for teams already using Git.

**Can two users edit the same file?**  
Yes, but the reservation system reduces conflicts. Conflicts can still happen and must be resolved.

**Does this replace paid sync services?**  
For many teams, yes. For real-time collaboration, a dedicated sync service may be better.

**Which AI provider should I choose?**

- **GPT‑5** for general use and balanced performance.
- **Claude** for complex reasoning.
- **Gemini** for very long contexts.
- **Ollama** for privacy and offline use.

**Can I use multiple AI providers?**  
Yes — configure multiple and switch anytime.

**Is my data sent to AI providers?**  
Only when using cloud providers. Ollama keeps everything local.

---

## License

MIT © 2025 Luis Dourado
