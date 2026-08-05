import { runTests } from '@vscode/test-electron';
import { fileURLToPath } from 'node:url';

await runTests({
  version: process.env.VSCODE_TEST_VERSION || 'stable',
  extensionDevelopmentPath: fileURLToPath(new URL('..', import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL('../dist/test/extension.test.cjs', import.meta.url)),
  launchArgs: [fileURLToPath(new URL('../tests/fixtures', import.meta.url)), '--disable-extensions']
});
