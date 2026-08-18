# GyosJS for Visual Studio Code

Official editor support for [GyosJS](https://github.com/gyosjs/gyosjs), a reactive HTML library for server-rendered websites and boosted MPA navigation.

The extension helps you write GyosJS templates without requiring a framework-specific build step or JavaScript language server. It understands the public template contract and works in desktop VS Code and browser-based VS Code clients.

> The extension is currently a preview. Diagnostics are intentionally conservative while the GyosJS API stabilizes.

## Features

- Syntax highlighting for GyosJS directives, structural directives, event handlers, bindings, interpolations, and auto-scope attributes.
- Attribute completion for the full built-in template and MPA Boost API.
- Generic reactive attribute support for ARIA, data, form metadata, and custom attributes.
- Value completion for transitions, validators, hydration strategies, swap modes, HTTP methods, bindings, events, and modifiers.
- Hover documentation with a runnable syntax example and a link to the canonical GyosJS documentation.
- Snippets for scopes, keyed loops, conditionals, validated forms, reveals, portals, boosted layouts, partial router actions, persisted media, and strict-CSP CDN setup.
- Conservative diagnostics for deterministic contract mistakes such as orphan branches, malformed `*for`, invalid modifiers, unsafe model paths, and missing companion directives.
- Workspace-aware semantic highlighting, completion, hover, Ctrl+Click, and references for scopes, members, aliases, refs, and GyosJS registries.
- Runtime API and component-context IntelliSense for inline scripts and expressions, including `Gyos.provide/inject`, `Gyos.setCspNonce`, event channels, `$refs`, `$inject`, `$emit`, `$on`, `$watch`, and form-state helpers.
- Cross-template navigation for dependency keys, `g-on:*` channels, `g-ref` members, `*for` sources/aliases, custom transitions, validators, and pipes.
- MPA Boost target navigation, static HTML route navigation, persist references, and a `GyosJS: Audit MPA Boost` workspace command.

```html
<main g-scope="Cart" g-outlet>
  <ul>
    <li *for="line, index in lines" g-key="line.id">
      <input g-model.number="line.quantity">
      <span>{line.total}</span>
    </li>
  </ul>
</main>
```

## Template Support

Language features activate for:

- HTML (`html`)
- PHP templates (`php`)
- Blade language IDs used by common Laravel extensions (`blade` and `laravel-blade`)

Snippets are registered directly for HTML and PHP. In Blade files, completions, hovers, diagnostics, and injected syntax highlighting remain available when the installed Blade extension exposes one of the supported language IDs.

GyosJS deliberately supports custom directives, validators, transitions, and DOM events. The extension does not report unknown custom `g-*` attributes or custom transition names as errors.

Add `g-ignore` to a subtree when GyosJS should not process it. The extension follows the same boundary and suppresses GyosJS diagnostics inside that subtree.

## Runtime Compatibility

Extension `0.2.x` tracks the public template and runtime contract of GyosJS `0.3.x`, including `g-reveal`, generic reactive attributes, `g-show` transitions, and the optional strict-CSP distribution.

The standard and CSP builds use the same template attributes, so highlighting, completion, hover, and navigation work for both. The CSP build intentionally accepts a smaller expression language. The extension does not execute expressions or attempt full CSP-expression validation; use the CSP compatibility table in the GyosJS documentation when authoring strict-CSP templates.

## Commands And Settings

Open the Command Palette and run:

- `GyosJS: Open Documentation`
- `GyosJS: Open API Reference`
- `GyosJS: Open MPA Boost Guide`

Set `gyosjs.diagnostics.enabled` to `false` for a workspace or file scope to disable diagnostics without disabling completions and hovers.

Workspace indexing starts lazily after GyosJS syntax is detected. It honors VS Code `files.exclude`, skips common dependency/cache/generated paths, and ignores `.min.js`, `.d.ts`, and files larger than 512 KiB by default.

- Add project-specific path fragments to `gyosjs.indexing.exclude`.
- Change `gyosjs.indexing.maxFileSizeKb` when authored GyosJS source legitimately exceeds the default limit.
- Set `gyosjs.indexing.enabled` to `false` to disable cross-file indexing.

## Installation

Install **GyosJS** from the Visual Studio Marketplace or Open VSX. For local testing, build a VSIX and install it with **Extensions: Install from VSIX...**:

```bash
npm ci
npm run package
```

## Development

Node.js 20 or newer is required.

```bash
npm ci
npm run check
npm run test:integration
npm run test:web
```

`npm run check` performs TypeScript checking, unit tests, and a production build. Integration tests start an isolated desktop Extension Host; web tests start VS Code for the Web in headless Chromium.

The language contract is maintained in `src/language/contract.ts`. Any contract change should be checked against the matching GyosJS runtime source and user documentation before release.

## Privacy

The extension does not collect telemetry, execute template expressions, start a language server, or send document contents over the network. Documentation commands only open public `github.com/gyosjs/gyosjs` pages in your browser.

## License

[MIT](LICENSE.md)
