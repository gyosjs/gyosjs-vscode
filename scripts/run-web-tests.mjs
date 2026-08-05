import { runTests } from '@vscode/test-web';
import { fileURLToPath } from 'node:url';

await runTests({
  browserType: 'chromium',
  quality: process.env.VSCODE_TEST_QUALITY === 'insiders' ? 'insiders' : 'stable',
  extensionDevelopmentPath: fileURLToPath(new URL('..', import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL('../dist/web/test.js', import.meta.url)),
  headless: true
});
