# Changelog

All notable changes to Compoviz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/adavesik/compoviz/compare/ac84f4b...v0.2.0
[0.1.0]: https://github.com/adavesik/compoviz/releases/tag/v0.1.0
