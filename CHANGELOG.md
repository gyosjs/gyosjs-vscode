# Changelog

All notable changes to the GyosJS Visual Studio Code extension are documented here.

## 0.3.0 - 2026-09-14

### Added

- GyosJS 0.4 contract: completion, hover, highlighting and MPA audit recognition for `g-boost-errors`, `g-head-persist` and `g-router-remove`.
- Runtime API completion/hover for `onBeforeSwap` and `onNavigationEnd`; existing navigation hooks describe context and unsubscribe.

### Changed

- Compatibility guidance and regression fixtures track the GyosJS 0.4 router contract.

## 0.2.0 - 2026-08-18

### Added

- Language contract coverage for GyosJS 0.3.x, including completion and hover for `Gyos.setCspNonce()` and `Gyos.version`.
- Snippets for built-in `g-reveal` and strict-CSP CDN setup with the required static runtime stylesheet.
- CSP entry-point coverage for default and named GyosJS imports.

### Changed

- Runtime API descriptions now document the optional `Gyos.inject()` fallback and element-aware `Gyos.getTransitionConfig()` signature.
- README compatibility guidance distinguishes standard expressions from the restricted strict-CSP expression language.

### Fixed

- The validated-form snippet now calls the form-state signal as `$invalid()` and no longer disables MPA Boost as an obsolete validation workaround.

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
