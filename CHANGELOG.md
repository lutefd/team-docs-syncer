# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

- Nothing yet.

## [1.2.1] - 2025-08-12

### Changed

- Streamed AI response generation for file edits in write mode, displaying progress in the chat interface.
- Removed redundant path check in edit application (assumed handled upstream).
- Simplified success notice for applied edits.
- Updated error notice text for generate & apply failures.

### Fixed

- Ensured streamed edit responses are properly rendered as Markdown and handled empty responses via fallback.

## [1.2.0] - 2025-08-12

### Added

- AI integration with OpenAI for chatbot functionality, including chat and write modes.
- New services: `AiService` for handling AI interactions, `MarkdownIndexService` for indexing and searching Markdown files, `ChatSessionService` for managing chat sessions.
- New UI components: `ChatbotView` for the main chatbot interface, `ChatSessionsModal` for session management, `DiffModal` for reviewing changes, `EditTargetModal` for selecting edit targets.
- New tools in `AiTools.ts` for searching docs, reading docs, proposing edits, and creating docs.
- OpenAI settings: API key, model, temperature, and max tokens in `SettingsTab.ts`.
- Ribbon icon and command for opening the Team Docs Chatbot.
- Streaming support for AI responses in chatbot.
- Sources panel in chatbot to display referenced files.
- Proposal review and application for write mode edits, with reservation checks.
- Retry logic with exponential backoff for git commands in `GitService.ts` to handle transient failures.

### Changed

- Bumped version to `1.2.0` in `manifest.json`, `package.json`, and `version.json`.
- Updated `.gitignore` to include `dist` and `.DS_Store`.
- Enhanced file handling in `FileHandlers.ts` with additional reservation syncs before reverting changes.
- Registered chatbot view in `main.ts`.
- Improved command manager to include open chatbot command.
- Updated reservation manager with `git add -A` before commits and retries for push/fetch.
- Changed activity feed refresh interval to 30 seconds in `TeamActivityFeed.ts`.
- Extended UIManager with `openChatbot` method.
- Added dependencies: `@ai-sdk/openai`, `ai`, `zod` in `package.json`.
- Updated styles in `styles.css` for chatbot UI elements.

### Fixed

- Improved reliability of reservation syncing with retries in `EditReservationManager.ts`.

## [1.1.1] - 2025-08-09

### Fixed

- Resolve TypeScript timer typing errors for `clearInterval(...)` by switching to `ReturnType<typeof setInterval>` in `main.ts` and `src/ui/TeamActivityFeed.ts`.

### Build

- Output artifacts to `dist/team-docs-syncer/` and copy `manifest.json` and `styles.css` via an esbuild plugin in `esbuild.config.mjs`.

### Chore

- Bump version map to `1.1.1` in `version.json`.

## [1.1.0] - 2025-08-09

### Added

- Offline editing support: reservation checks/enforcement only when the remote is reachable.
- `GitService.isRemoteReachable(timeoutMs?: number)` in `src/services/GitService.ts` to detect connectivity via a quick `git ls-remote`.

### Changed

- `FileHandler.onFileModified()` and `FileHandler.onEditorChange()` in `src/handlers/FileHandlers.ts`:
  - Online: preserve original behavior (sync/extend reservations, revert unauthorized edits, enforce read-only for others’ reservations).
  - Offline: skip reservation sync/enforcement and do not revert edits.

### Tests

- `tests/services/GitService.test.ts`: success/failure coverage for `isRemoteReachable()`.
- `tests/handlers/FileHandlers.test.ts`:
  - No read-only enforcement on editor change when offline.
  - No revert or reservation attempts on modify when offline.
- `tests/helpers/mockPlugin.ts`: adds `gitService.isRemoteReachable` mock.

### Notes

- Auto-commit still requires a valid local reservation; offline commits are skipped unless you already hold one.
- `.gitignore`: now ignores `coverage`.

## [1.0.0] - 2025-08-09

### Added

- UI elements and triggers for views (`feat: add ui elements and triggers for views`)
- Entry point (`feat: add entrypoint`)
- Styling sheet (`feat: add styling sheet`)
- Settings type (`feat: add settings type`)
- Git service (`feat: add git service`)
- UI, commands and reservation managers (`feat: add ui, commands and reservation managers`)
- File handlers (`feat: add file handlers`)

### Changed

- Improve pathing for git commands (`feat: improve pathing for git cmds`)

### Documentation

- Add README (`docs: add readme`)
- Add LICENSE (`docs: add LICENSE`)

### Tests

- Add test for all main modules (`test: add test for all main modules`)

### Chore

- Initial setup (`chore: initial setup`)
- Export stub properly to build (`chore: export stub properly to build`)

[Unreleased]: https://github.com/lutefd/team-docs-syncer/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.2.1
[1.2.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.2.0
[1.1.1]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.1
[1.1.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.0
[1.0.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.0.0
