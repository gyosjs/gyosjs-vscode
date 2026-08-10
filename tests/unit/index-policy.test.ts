import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_FILE_SIZE_KB,
  exceedsIndexSize,
  hasGyosSourceHint,
  indexSearchExclude,
  isExcludedPath
} from '../../src/language/index-policy';

describe('workspace index policy', () => {
  it('excludes dependency, generated, cache, declaration, and minified files', () => {
    const excluded = [
      '/project/node_modules/pkg/index.js',
      '/project/vendor/composer/autoload.php',
      '/project/storage/framework/cache/phpstan/result.php',
      '/project/.tmp-composer/phpstan/cache/result.php',
      '/project/public/built/app.js',
      '/project/types/runtime.d.ts',
      '/project/public/assets/runtime.min.js'
    ];

    expect(excluded.every(path => isExcludedPath(path))).toBe(true);
    expect(isExcludedPath('/project/themes/harvest/assets/theme.js')).toBe(false);
    expect(isExcludedPath('/project/generated/custom.php', ['/generated/'])).toBe(true);
  });

  it('detects Gyos templates and script registrations without matching ordinary files', () => {
    expect(hasGyosSourceHint('/project/page.blade.php', '<main g-scope="Page">{title}</main>')).toBe(true);
    expect(hasGyosSourceHint('/project/page.html', '<button @click="save()">Save</button>')).toBe(true);
    expect(hasGyosSourceHint('/project/app.ts', "import { scope } from 'gyosjs';")).toBe(true);
    expect(hasGyosSourceHint('/project/app.js', "Gyos.scope('Page', {})")).toBe(true);
    expect(hasGyosSourceHint('/project/plain.php', '<?php return [\'cache\' => true];')).toBe(false);
    expect(hasGyosSourceHint('/project/plain.js', 'export const value = factory();')).toBe(false);
  });

  it('enforces the configurable file-size ceiling', () => {
    expect(exceedsIndexSize(DEFAULT_MAX_FILE_SIZE_KB * 1024)).toBe(false);
    expect(exceedsIndexSize(DEFAULT_MAX_FILE_SIZE_KB * 1024 + 1)).toBe(true);
    expect(exceedsIndexSize(65 * 1024, 64)).toBe(true);
  });

  it('combines built-in search guards with VS Code files.exclude rules', () => {
    const exclude = indexSearchExclude({ '**/.generated/**': true, '**/keep/**': false });

    expect(exclude).toContain('**/node_modules/**');
    expect(exclude).toContain('**/storage/framework/**');
    expect(exclude).toContain('**/.generated/**');
    expect(exclude).not.toContain('**/keep/**');
  });
});
