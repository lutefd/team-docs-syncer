# Team Docs Git Sync (Obsidian Plugin)

Collaborate on Markdown notes with your team using a regular Git server as the sync backend. This Obsidian plugin adds lightweight collaboration features on top of Git, including edit reservations, automatic commits, conflict helpers, and an activity feed — all without any paid sync services.

It has limitations (see below), but it’s free, auditable, and works well for small to mid-sized teams who are comfortable with Git.

## Key Features

- **Git-based sync**: Uses your own Git repository (GitHub/GitLab/Bitbucket/self-hosted).
- **Edit reservations**: Prevents accidental overwrites by letting a user “reserve” a file for a limited time.
- **Auto-commit on change**: Automatically stages and commits edits after a short idle period.
- **Activity feed**: See recent team activity and reservation events.
- **Status indicator**: Live status (synced/syncing/conflict/error) in Obsidian’s status bar.
- **Conflict helpers**: Prompts to resolve conflicts or handle local changes safely.
- **Configurable**: Set team docs folder, remote URL, attachments subdirectory, and more.

## How It Works

- Your vault contains a subfolder (e.g., `Team/Docs`) designated as the shared "Team Docs" root.
- The plugin runs Git commands in that folder: fetch/pull/push, add/commit, etc.
- Edit reservations are recorded via empty Git commits (e.g., `[RESERVE] path - user - timestamp`).
- On save/idle, the plugin auto-commits your changes and nudges the status indicator to sync.
- If someone else has reserved a file, the plugin warns you and can restore the file if needed.

## Requirements

- Obsidian Desktop (Git operations require a local filesystem).
- Git installed and available on PATH.
- A writable Git remote (e.g., GitHub/GitLab/Bitbucket/self-hosted).

## Installation (Development)

1. Clone this repo next to your Obsidian vault or as a separate project.
2. Install dependencies:
   - `pnpm install`
3. Build and watch during development:
   - `pnpm dev`
4. Build for production:
   - `pnpm build`
5. Copy or symlink the build output to your vault’s `.obsidian/plugins/team-docs-git-sync/` directory as needed.

## Configuration

Open the plugin’s settings tab in Obsidian:

- **Team Docs Folder**: Root path inside your vault for shared docs (e.g., `Team/Docs`).
- **Git Remote URL**: URL of your repository.
- **User Name / Email**: Used for Git commits and displayed in reservations.
- **Auto Sync on Startup**: Optionally sync on Obsidian launch.
- **Auto Sync Interval (min)**: Periodic sync interval (0 to disable).
- **Attachments Subdirectory**: Subfolder under Team Docs where pasted images are moved (e.g., `assets`).

## Typical Workflow

- Open a file under the Team Docs folder.
- Start editing; the plugin will try to reserve the file for you.
- While you edit, the reservation auto-extends if it’s near expiry.
- After a short idle period, the plugin auto-commits your changes.
- Use the Status Indicator menu to trigger syncs, check for updates, or open the activity feed.

## UI Overview

- **Status Indicator**: Shows current state and opens actions/tooltip.
- **Activity Feed**: Right-side view listing recent commits and reservation events.
- **Reservation Indicator**: In the active view header, shows reservation owner and lets you release your own reservation.

## Handling Conflicts

- Local changes that would be overwritten trigger a modal to choose: Commit & Sync, Stash & Sync, or Discard & Sync.
- Merge conflicts surface a conflict resolution modal, where you can pick a strategy or resolve manually.

## Limitations

- Not real-time; sync is Git-based and periodic.
- Edit reservations are cooperative. They help avoid conflicts, but cannot strictly prevent them.
- Works on desktop (mobile support is limited because Git CLI is required).
- Large binary files or extremely large repos may degrade performance.

## Security & Privacy

- Your notes stay in your repository. No third-party servers beyond your chosen Git host.
- Do not commit secrets accidentally. Use `.gitignore` as appropriate.

## Troubleshooting

- Ensure Git is installed and available in PATH.
- Verify your remote URL and credentials.
- Check the console for Git command errors.
- If UI tests fail in development, ensure `jest-environment-jsdom` is installed and mocks are up-to-date.

## Development

- Test suite: `pnpm test`
- Source highlights:
  - Handlers: `src/handlers/FileHandlers.ts`
  - Managers: `src/managers/*`
  - Services: `src/services/GitService.ts`
  - UI: `src/ui/*`
- Tests: `tests/**/*`

## FAQ

- **Why Git instead of a real-time sync?**
  - Git is free, ubiquitous, and works offline. This plugin makes it practical for teams who already use Git.
- **Can two users edit the same file?**
  - Technically yes, but the reservation system tries to coordinate and reduce conflicts. Conflicts can still happen and must be resolved.
- **Does this replace paid sync services?**
  - For some teams, yes. For others needing real-time collaboration, a dedicated sync service may still be better.

## License

MIT © 2025 Luis Dourado
