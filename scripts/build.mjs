import { mkdir } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const shared = {
  bundle: true,
  sourcemap: production ? false : 'inline',
  minify: production,
  external: ['vscode'],
  logLevel: 'info'
};

await mkdir(new URL('../dist/node', import.meta.url), { recursive: true });
await mkdir(new URL('../dist/web', import.meta.url), { recursive: true });
await mkdir(new URL('../dist/test', import.meta.url), { recursive: true });

const configs = [
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/node/extension.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node20'
  },
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/web/extension.js',
    platform: 'browser',
    format: 'cjs',
    target: 'es2022'
  },
  {
    ...shared,
    entryPoints: ['tests/integration/extension.test.ts'],
    outfile: 'dist/test/extension.test.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node20'
  },
  {
    ...shared,
    entryPoints: ['tests/web/index.ts'],
    outfile: 'dist/web/test.js',
    platform: 'browser',
    format: 'cjs',
    target: 'es2022'
  }
];

if (watch) {
  const contexts = await Promise.all(configs.map(config => esbuild.context(config)));
  await Promise.all(contexts.map(context => context.watch()));
  console.log('Watching GyosJS extension sources...');
} else {
  await Promise.all(configs.map(config => esbuild.build(config)));
}
