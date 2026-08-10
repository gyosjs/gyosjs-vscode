# Changelog

All notable changes to the GyosJS Visual Studio Code extension are documented here.

## 0.1.2 - 2026-08-10

### Fixed

- Workspace indexing no longer starts for unrelated HTML/PHP documents and now honors VS Code `files.exclude` rules.
- Laravel framework caches, temporary Composer/PHPStan data, generated output, declaration files, and minified scripts are excluded by default.
- Large files are skipped before reading or parsing, with a configurable `gyosjs.indexing.maxFileSizeKb` ceiling.
- JavaScript symbol scanning now checks code offsets in linear time instead of repeatedly rescanning from the start of the source.
- Workspace scans use bounded batches with event-loop yields, and unchanged open documents reuse their versioned index.
- JavaScript symbol offsets remain correct when source text contains astral Unicode characters.

## 0.1.1 - 2026-08-09

### Added

- Completions and hover contract coverage for common ARIA, data, and form metadata bindings introduced by GyosJS 0.2.0.

### Fixed

- Generic safe bindings no longer produce an unsupported-binding diagnostic.
- `g-transition` used with `g-show` is now recognized as a valid transition target.
- Unsafe executable and framework-owned dynamic attribute names remain diagnosed.

## 0.1.0 - 2026-08-06

### Added

- Syntax highlighting for GyosJS template syntax in HTML, PHP, and Blade grammars.
- Contract-aware completions and hover documentation.
- Conservative template diagnostics with `g-ignore` boundary support.
- Workspace-aware scope and registry indexing, semantic highlighting, navigation, references, and contextual completion.
- Conservative MPA Boost diagnostics and local target/static HTML navigation.
- Public `Gyos.*` and component-context API completion, hover, and semantic highlighting in inline scripts and template expressions.
- Navigation for DI providers/injections, event emitters/listeners, refs, form state, loop sources/aliases, transitions, validators, and pipes.
- HTML and PHP snippets for common reactive and MPA Boost patterns.
- Desktop and web extension bundles.
- Unit, desktop Extension Host, and web Extension Host test suites.
