# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

- Nothing yet.

## [1.5.0] - 2025-08-15

### Added

- Automatic attachment of file contents for wiki-style mentions in messages via `FileContentExtractor.ts`.
- Support for displaying AI thinking/reasoning in collapsible sections using <think> tags in `MessageRenderer.ts`.
- onThoughts callback in `AiService.ts` for streaming thinking process.
- Retry logic for AI tool executions in `AiTools.ts`.
- Mode-specific prompts and workflows in `AiService.ts` for handling attached content, Ollama/Mistral enforcement, and thinking tags.
- lastUsedMode tracking in settings for persisting user's preferred mode.
- Styles for thinking sections in `styles.css`.

### Changed

- Updated README files to use full GitHub releases URLs.
- Migration in `main.ts` for splitting old Ollama models into compose and chat categories.
- Added dependency "@ai-sdk/openai-compatible": "^1.0.7" in `package.json`.
- Updated mode toggle in `SessionManager.ts` to include "compose".
- Mode-aware model filtering in `AiProviderFactory.ts` for Ollama (compose vs chat models).
- Simplified Ollama provider in `OllamaProvider.ts` using OpenAI-compatible wrapper.
- Enhanced tools in `AiTools.ts` to handle wiki links in paths.
- Split Ollama model settings in `SettingsTab.ts` into compose and chat.
- Integrated file content extraction in `ChatbotView.ts` for chat and compose modes.
- Added updateMode to `ProviderChooser.ts` and `ChatInput.ts`.
- Message processing in `MessageRenderer.ts` to handle and remove <attachedcontent> tags.
- Streaming in `AiService.ts` to parse <think> and <finalAnswer> tags separately.

### Fixed

- Improved file path resolution for mentions and tools.

## [1.4.0] - 2025-08-14

### Added

- **Multi-provider AI support**: Full support for OpenAI, Anthropic (Claude), Google (Gemini), and Ollama (local models)
  - New `AiProviderFactory` service for creating AI provider instances
  - Provider-specific model configurations with support for tools and streaming
  - Automatic provider testing and connection validation
- **Enhanced Chat Interface**: Complete redesign of the chatbot UI with modern components
  - `ChatInput` component with mention handling and provider selection
  - `MessageRenderer` component for consistent message display with streaming support
  - `LinkHandler` component for proper internal link resolution
  - `SessionManager` component for session and pin management
  - Real-time provider status indicators
- **Responsive Design**: Adaptive UI that works across different screen sizes
  - JavaScript-based responsive detection with CSS classes
  - Optimized layouts for narrow, very-narrow, and extremely-narrow viewports
  - Mobile-friendly input controls and touch interactions
- **Improved File Operations**: Enhanced content editing and creation workflows
  - Editable diff modal allowing content modification before applying changes
  - Better file creation handling with automatic folder structure
  - Enhanced proposal and creation handling in both chat and write modes
- **Advanced Mention System**: Smart file referencing with autocomplete
  - File search and filtering within team docs
  - Visual mention menu with keyboard navigation
  - Automatic pinning of mentioned files

### Changed

- **Settings Migration**: Automatic migration from legacy OpenAI-only settings to multi-provider configuration
  - Legacy `openaiApiKey` and `openaiModel` settings preserved for backward compatibility
  - New nested `ai` settings structure with provider-specific configurations
- **Improved Error Handling**: Better error messages and fallback mechanisms
  - Provider-specific error handling and status reporting
  - Graceful degradation when providers are unavailable
- **Enhanced Markdown Rendering**: Better support for internal links and wiki-style references
  - Improved link extraction and processing
  - Better handling of file references in AI responses
- **Streamlined Tool Integration**: Updated AI tools for better compatibility across providers
  - Google-compatible tool definitions with simplified return types
  - Enhanced tool result processing and error handling

### Dependencies

- Added `@ai-sdk/anthropic` ^2.0.4 for Claude models support
- Added `@ai-sdk/google` ^2.0.6 for Gemini models support
- Added `@ai-sdk/provider` ^2.0.0 and `@ai-sdk/provider-utils` ^3.0.3 for provider abstraction
- Updated `@ai-sdk/openai` to ^2.0.11
- Updated `ai` to ^5.0.11
- Updated `zod` to ^4.0.17

### Technical Improvements

- **Modular Architecture**: Separated concerns into focused components and services
  - Clean separation between UI components, AI services, and business logic
  - Improved maintainability and testability
- **Custom Ollama Provider**: Complete implementation of Ollama provider with streaming support
  - Full compatibility with the AI SDK provider interface
  - Support for local model management and configuration
- **Better Type Safety**: Enhanced TypeScript definitions and interfaces
  - Strong typing for provider configurations and model settings
  - Improved error handling with typed exceptions

### UI/UX Improvements

- **Modern Interface Design**: Updated styling with CSS custom properties and better visual hierarchy
- **Accessibility**: Improved keyboard navigation and screen reader support
- **Performance**: Optimized rendering and reduced unnecessary re-renders
- **Visual Feedback**: Better loading states, status indicators, and user feedback

### Bug Fixes

- Fixed internal link resolution in AI responses
- Improved file path handling across different operating systems
- Better error recovery when AI providers are temporarily unavailable
- Fixed mention menu positioning and interaction issues

### Chore

- Bump version to 1.4.0 in `manifest.json`, `package.json`, and `version.json`

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
  - Online: preserve original behavior (sync/extend reservations, revert unauthorized edits, enforce read-only for others' reservations).
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

[Unreleased]: https://github.com/lutefd/team-docs-syncer/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.5.0
[1.4.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.4.0
[1.1.1]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.1
[1.1.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.0
[1.0.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.0.0
