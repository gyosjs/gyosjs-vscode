import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_DEFINITIONS } from '../../src/language/contract';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;

interface Grammar {
  repository: {
    'attribute-names': {
      patterns: Array<{ match: string }>;
    };
  };
}

interface Snippet {
  prefix: string;
  body: string[];
}

interface Manifest {
  main: string;
  browser: string;
  contributes: {
    grammars: Array<{ path: string }>;
    snippets: Array<{ path: string }>;
  };
}

describe('extension manifest assets', () => {
  it('highlights every exact built-in attribute name', () => {
    const grammar = readJson<Grammar>('syntaxes/gyos.injection.json');
    const patterns = grammar.repository['attribute-names'].patterns.map(pattern => new RegExp(pattern.match));

    for (const definition of ALL_DEFINITIONS) {
      expect(patterns.some(pattern => pattern.test(`${definition.name}=`)), definition.name).toBe(true);
    }
  });

  it('keeps snippet prefixes unique and bodies non-empty', () => {
    const snippets = Object.values(readJson<Record<string, Snippet>>('snippets/gyos.code-snippets'));
    expect(new Set(snippets.map(snippet => snippet.prefix)).size).toBe(snippets.length);
    expect(snippets.every(snippet => snippet.body.length > 0)).toBe(true);
  });

  it('ships current form, reveal, and strict-CSP snippets', () => {
    const snippets = Object.values(readJson<Record<string, Snippet>>('snippets/gyos.code-snippets'));
    const byPrefix = new Map(snippets.map(snippet => [snippet.prefix, snippet.body.join('\n')]));

    expect(byPrefix.get('gyos-form')).toContain('$invalid()');
    expect(byPrefix.get('gyos-form')).not.toContain('g-no-boost');
    expect(byPrefix.get('gyos-reveal')).toContain('g-reveal');
    expect(byPrefix.get('gyos-csp-cdn')).toContain('gyos.csp.auto.min.js');
    expect(byPrefix.get('gyos-csp-cdn')).toContain('gyos.css');
  });

  it('points package contributions at tracked assets', () => {
    const manifest = readJson<Manifest>('package.json');
    const paths = [
      ...manifest.contributes.grammars.map(item => item.path),
      ...manifest.contributes.snippets.map(item => item.path)
    ];
    expect(paths.every(path => existsSync(resolve(root, path)))).toBe(true);
    expect(manifest.main).toBe('./dist/node/extension.cjs');
    expect(manifest.browser).toBe('./dist/web/extension.js');
  });
});
