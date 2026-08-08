# Maintaining The GyosJS VS Code Extension

The GyosJS runtime is the template-contract source of truth. This extension may release independently for editor fixes, but it must not advertise syntax or behavior that the public runtime documentation does not support.

## Compatibility

- The minimum supported VS Code version is declared in `engines.vscode` and covered by the `minimum-vscode` CI job.
- Desktop and web Extension Hosts are both supported and must pass before release.
- HTML, PHP, Blade, and Laravel Blade fixtures remain first-class test targets.
- A GyosJS runtime patch does not require an extension release when directives, modifiers, context APIs, validators, transitions, bindings, and router attributes are unchanged.

## Runtime Contract Changes

When the runtime template contract changes:

1. compare `src/language/contract.ts` with the released runtime API reference and examples
2. update grammar scopes, completion, hover, navigation, diagnostics, snippets, and MPA audit behavior where applicable
3. add fixtures for HTML, PHP, and Blade forms of the syntax
4. keep diagnostics conservative around custom directives, pipes, validators, transitions, scopes, and providers
5. publish only after canonical runtime documentation links are available

Do not diagnose an extension point merely because its name is absent from the built-in catalog. Workspace registrations and dynamic application code remain valid.

## Issue Triage

- Record the extension version, VS Code version, language mode, file type, and smallest workspace fixture.
- Separate grammar highlighting from language-service completion, hover, definition, indexing, or diagnostic failures.
- For MPA audit reports, include trigger markup, route shape, target/outlet, swap, and expected history behavior.
- Confirm runtime behavior before changing editor diagnostics. Runtime bugs belong in `gyosjs/gyosjs`.

## Release Checklist

1. Update the extension version and release notes.
2. Run `npm ci`, `npm audit --audit-level=high`, and `npm run check`.
3. Run `npm run test:integration` and `npm run test:web`.
4. Run the minimum VS Code job and inspect the generated VSIX artifact.
5. Tag the exact verified commit.
6. Publish the same VSIX to Visual Studio Marketplace and Open VSX.
7. Verify installation, activation, documentation commands, completion, hover, and Ctrl+Click from both registries.

Keep registry publishing opt-in through repository variables. A tag always produces a GitHub Release artifact even when registry publishing is disabled.
