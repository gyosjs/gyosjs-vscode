# Release Process

This repository publishes the official `gyosjs.gyosjs` extension to the Visual Studio Marketplace and Open VSX.

## One-Time Setup

- Create `https://github.com/gyosjs/gyosjs-vscode` and push this repository to its `main` branch.
- Reserve or create the `gyosjs` publisher in the Visual Studio Marketplace.
- Create the `gyosjs` namespace in Open VSX.
- Add `VSCE_PAT` and `OVSX_PAT` as GitHub Actions secrets. Scope each token only to extension publishing.
- Protect the `marketplace` GitHub environment if release approval is required.

## Prepare A Version

1. Synchronize `src/language/contract.ts` with the released `gyosjs/gyosjs` runtime and its English API reference.
2. Run `npm audit`, `npm run test:integration`, `npm run test:web`, and `npm run package` from a clean checkout using Node.js 20.
3. Install the generated VSIX in desktop VS Code and smoke-test HTML, PHP, and a Blade file.
4. Update `version` in `package.json` and `package-lock.json` together.
5. Replace `Unreleased` in `CHANGELOG.md` with the release date.
6. Commit the release and create a matching tag such as `v0.1.0`.

The tag version must equal `package.json#version`. The release workflow rejects a mismatch, packages one VSIX, publishes that artifact to both registries, and creates the GitHub Release.

## Manual Fallback

If registry automation is unavailable, use the same verified checkout:

```bash
npm run package
npx vsce publish --pat <marketplace-token>
npx ovsx publish gyosjs-0.1.0.vsix -p <open-vsx-token>
```

Never reuse a version after one registry accepts it. Fix the issue, increment the patch version, and publish a new release.
