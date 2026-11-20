# Changelog

All notable changes to Compoviz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-20

First stable release, centered on a rebuilt Compare mode.

### Added
- **Interactive Compare mode** - Inspector panel, context menus, hover cards, issue navigation (J / K) and keyboard shortcuts
- **One-click conflict fixes** - Remap host ports, rename or drop `container_name`, set a distinct project name, split bind mounts or mount them read-only, share or externalize networks and volumes. Every fix shows a diff preview and supports undo / redo
- **Export fixed projects** - Download, copy YAML or open any compared project in the editor
- **Conflict-aware diagram** - Port chips on service nodes, dedicated conflict nodes, and a cross-project resources lane
- **Compare demo** - Three demo stacks with real conflicts, available from the What's New modal and the Compare empty state
- **What's New for 1.0** - Hero layout with a Compare screenshot, feature grid and a "Try the Compare demo" action

### Changed
- **Detection accuracy** - Wildcard IP overlap, protocol-aware and range-aware ports, ephemeral ports ignored, project name collisions, project-scoped networks and volumes
- **Pan & zoom** - Cursor-anchored zoom, pinch, fit-to-view and click-vs-drag detection
- **Compare persistence** - Compared projects survive reloads (localStorage); projects can be pasted as YAML or taken from the editor
- **What's New gating** - The modal is keyed by announcement version, so patch releases no longer re-show an old announcement

### Also since 0.5.0
- **Healthcheck intelligence** (v0.5.1) - Flags missing, fake and weak healthchecks, and `service_healthy` dependencies that can never start
- **Canonical Compose AST** (v0.5.1) - Shared model behind analysis features

## [0.2.0] - 2026-01-16

### Added
- **React Context Architecture** - Implemented ComposeProvider and UIProvider for clean state management
- **Comprehensive Component Tests** - Added 33 new component tests covering all application modes
  - CompareView component tests (Compare mode)
  - VisualBuilder component tests (Build mode)
  - MainLayout component tests (Editor mode)
  - CodePreview component tests
- **Test Infrastructure** - Set up React Testing Library with browser API mocks
- **Test Utilities** - Created provider wrapper utilities for consistent test setup
- **ComposeReducer Module** - Extracted reducer and initial state to separate file for better organization

### Changed
- **Major Refactoring** - Reduced App.jsx from 459 lines to 25 lines (94% reduction)
- **Component Architecture** - All components now use hooks instead of props (eliminated prop drilling)
- **State Management** - Separated Data State (Docker Compose logic) from UI State (Interface logic)
- **File Extension** - Renamed useCompose.js to useCompose.jsx for JSX syntax compliance
- **Version Bump** - Updated to v0.2.0 to reflect significant architectural improvements

### Fixed
- **Lint Warnings** - Eliminated all Fast Refresh warnings by extracting non-component exports
- **Test Coverage** - Increased from 66 to 99 tests (50% increase)

### Internal
- **Plugin Foundation** - Prepared architecture for future plugin system integration
- **Provider Guards** - Added error guards to hooks ensuring proper context usage
- **localStorage Persistence** - Maintained existing functionality while refactoring
- **Undo/Redo Integration** - Preserved history management through context refactoring

### Testing
- All 99 tests passing
- Zero lint errors/warnings
- 100% backward compatibility maintained

## [0.1.0] - 2026-01-15

### Initial Release
- Docker Compose visual editor
- Multi-view support (Editor, Build, Diagram, Compare)
- YAML generation and validation
- React Flow visual builder
- Graphviz diagram generation
- Docker Compose Spec v2.x compliance
- Undo/Redo functionality
- Template system for common services
- localStorage persistence

[1.0.0]: https://github.com/adavesik/compoviz/compare/v0.5.1...v1.0.0
[0.2.0]: https://github.com/adavesik/compoviz/compare/ac84f4b...v0.2.0
[0.1.0]: https://github.com/adavesik/compoviz/releases/tag/v0.1.0
