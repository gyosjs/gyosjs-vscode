# Contributing

Bug reports and focused pull requests are welcome. Before changing editor behavior, confirm that the behavior is part of the current public GyosJS runtime contract rather than an undocumented demo or an experimental implementation detail.

Maintainers should also follow `MAINTAINING.md` for compatibility, contract synchronization, triage, and registry release checks.

## Development Setup

Use Node.js 20 or newer:

```bash
npm ci
npm run check
```

Use `npm run watch` while launching the extension through VS Code's **Run Extension** configuration.

## Tests

Run the narrowest relevant test while developing, then run the complete verification set before opening a pull request:

```bash
npm run test:unit
npm run test:integration
npm run test:web
npm run package
```

Contract and scanner changes require unit coverage. Provider behavior should be verified in the desktop Extension Host and, when browser-compatible code changes, in the web Extension Host.

## Contract Changes

When adding or changing syntax:

1. Verify the implementation in the `gyosjs/gyosjs` runtime source.
2. Update `src/language/contract.ts`.
3. Update the TextMate injection grammar and snippets when relevant.
4. Add or update diagnostics only for deterministic mistakes. Do not reject valid custom directives, events, validators, or transitions.
5. Update tests and the changelog.

Keep pull requests scoped to one behavior change. Do not include generated `dist`, `.vscode-test`, coverage, or VSIX files.
