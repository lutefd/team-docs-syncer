# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

- Nothing yet.

## [2.0.2] - 2025-08-22

### Bug Fixes

- Install wizard modal triggering reservations on initial clone.

## [2.0.1] - 2025-08-22

### Added

- First-time install wizard modal in `InstallWizard.ts` to guide users through Git repo cloning, folder naming, and user config setup.
- Check in `main.ts` to detect if setup is needed and launch the wizard automatically.

## [2.0.0] - 2025-08-22

### Added

- **MCP (Model Context Protocol) Support**: Complete integration with MCP servers

  - `MCPManager` for handling multiple MCP server connections
  - Support for STDIO, HTTP, and SSE transport types
  - Automatic OAuth flow detection and handling via `OAuthManager`
  - Dynamic MCP tool integration with AI conversations
  - MCP server configuration UI in settings
  - Connection status monitoring and retry logic

- **Advanced AI Context Management**: Intelligent conversation handling

  - `ContextManager` for building context with summarization and retrieval
  - `SummarizerService` for compacting conversation history
  - `MemoryService` for persistent fact/preference storage
  - `PlanningService` for automatic task planning and next steps
  - Token estimation and context policy enforcement

- **Enhanced AI Instructions System**: Modular prompt architecture

  - Separate instruction modules for different modes (compose, write, chat)
  - Provider-specific instructions (Ollama, Mistral optimizations)
  - MCP-aware system prompts with tool prioritization
  - Code formatting enforcement for better syntax highlighting

- **Expanded Tool Capabilities**: Comprehensive document analysis tools

  - `find_similar_to_doc` and `find_similar_to_many` for similarity search
  - `search_similar` with tag and content matching
  - `follow_links` with recursive link traversal
  - `get_backlinks` and `get_graph_context` for document relationships
  - `create_base` and `search_base_def` for Obsidian base files support
  - Planning tools (`planning_write`, `planning_update_section`, `memories_add`)

- **UI/UX Enhancements**: Improved chat interface and interactions

  - MCP server selection modal and status indicators
  - Enhanced message rendering with reasoning/thinking sections
  - Placeholder states and better loading feedback
  - Responsive design improvements for narrow viewports
  - File attachment processing with `<attachedcontent>` tags

- **Configuration Options**: Extensive customization capabilities
  - AI scope setting (team-docs vs vault-wide operations)
  - Context management settings (summarization, retrieval, history limits)
  - MCP client configuration with transport options
  - Enhanced provider settings with model-specific configurations

### Changed

- **Architectural Improvements**: Major code reorganization

  - Moved UI components to organized folder structure (`components/`, `modals/`)
  - Split AI tools into focused modules (`core/`, `obsidian/`, `navigation/`)
  - Enhanced service layer with specialized managers and utilities
  - Improved separation of concerns and modularity

- **Path Handling**: Comprehensive path utility system

  - `PathUtils` class for consistent path operations across team docs
  - Support for both team-docs scoped and vault-wide operations
  - Better Git path cleaning for multi-user repositories
  - Improved relative/absolute path conversions

- **Chat Session Management**: Enhanced conversation persistence

  - Automatic context compaction with conversation summarization
  - Session-specific scratchpads and memory storage
  - Better message history management with token-aware truncation
  - Improved pin management and file attachment handling

- **File Operations**: Better reservation and conflict handling
  - Enhanced reservation path handling with relative path storage
  - Improved Git commit message formatting for better parsing
  - Better error handling for file operations outside team docs scope
  - Enhanced activity feed with cleaner path display

### Dependencies

- Added `@modelcontextprotocol/sdk` ^1.17.3 for MCP server integration
- Updated various AI SDK dependencies for better provider support

### Technical Improvements

- **Performance**: Better caching and debounced operations
- **Error Handling**: Comprehensive error recovery and user feedback
- **Type Safety**: Enhanced TypeScript definitions and interfaces
- **Testing**: Updated test structures for new architecture

### Bug Fixes

- Fixed GPG signing issues in Git operations with fallback to `--no-gpg-sign`
- Improved file path resolution for mentions and cross-references
- Better handling of OAuth flows and permission errors
- Enhanced error messages for MCP server connection issues

### Breaking Changes

- Settings structure has been expanded with new sections for MCP and context management
- Some internal APIs have changed due to architectural improvements
- File path handling has been centralized through `PathUtils`

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

[Unreleased]: https://github.com/lutefd/team-docs-syncer/compare/v2.0.0...HEAD
[2.0.1]: https://github.com/lutefd/team-docs-syncer/releases/tag/v2.0.1
[2.0.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v2.0.0
[1.5.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.5.0
[1.4.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.4.0
[1.1.1]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.1
[1.1.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.1.0
[1.0.0]: https://github.com/lutefd/team-docs-syncer/releases/tag/v1.0.0
