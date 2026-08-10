const TEMPLATE_EXTENSIONS = ['.html', '.htm', '.php'];

export const DEFAULT_MAX_FILE_SIZE_KB = 512;

export const DEFAULT_INDEX_EXCLUDES = [
  '/.git/',
  '/.hg/',
  '/.svn/',
  '/node_modules/',
  '/vendor/',
  '/dist/',
  '/build/',
  '/coverage/',
  '/.cache/',
  '/.next/',
  '/.nuxt/',
  '/.output/',
  '/.turbo/',
  '/.vite/',
  '/.tmp/',
  '/.tmp-composer/',
  '/storage/framework/',
  '/bootstrap/cache/',
  '/public/build/',
  '/public/built/'
] as const;

const DEFAULT_INDEX_EXCLUDE_GLOBS = [
  '**/.git/**',
  '**/.hg/**',
  '**/.svn/**',
  '**/node_modules/**',
  '**/vendor/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/.turbo/**',
  '**/.vite/**',
  '**/.tmp/**',
  '**/.tmp-composer/**',
  '**/storage/framework/**',
  '**/bootstrap/cache/**',
  '**/public/build/**',
  '**/public/built/**',
  '**/*.min.js',
  '**/*.d.ts'
] as const;

const TEMPLATE_HINT = /(?:\bGyos\s*\.|\bg-(?:[a-z][\w-]*)(?:[.:]|\b)|\bgd-|\bgm-|(?:^|[\s<])(?:\*|@|:)[A-Za-z_$][\w$.-]*\s*=|\$(?:refs|inject|provide|emit|on|watch|effect)\b)/im;
const SCRIPT_HINT = /(?:\bGyos\s*\.|\bfrom\s*['"][^'"\r\n]*gyos[^'"\r\n]*['"]|\brequire\s*\(\s*['"][^'"\r\n]*gyos|\$(?:refs|inject|provide|emit|on|watch|effect)\b)/m;

export function isTemplatePath(path: string): boolean {
  const normalized = path.toLowerCase();
  return TEMPLATE_EXTENSIONS.some(extension => normalized.endsWith(extension));
}

export function isExcludedPath(path: string, configured: readonly string[] = []): boolean {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  if (normalized.endsWith('.min.js') || normalized.endsWith('.d.ts')) return true;
  return [...DEFAULT_INDEX_EXCLUDES, ...configured]
    .map(value => value.trim().replaceAll('\\', '/').toLowerCase())
    .filter(Boolean)
    .some(value => normalized.includes(value));
}

export function hasGyosSourceHint(path: string, source: string, template = isTemplatePath(path)): boolean {
  return (template ? TEMPLATE_HINT : SCRIPT_HINT).test(source);
}

export function exceedsIndexSize(size: number, maxFileSizeKb = DEFAULT_MAX_FILE_SIZE_KB): boolean {
  return size > Math.max(1, maxFileSizeKb) * 1024;
}

export function indexSearchExclude(filesExclude: Readonly<Record<string, unknown>> = {}): string {
  const configured = Object.entries(filesExclude)
    .filter(([, enabled]) => enabled !== false)
    .map(([pattern]) => pattern.trim())
    .filter(Boolean);
  return `{${[...new Set([...DEFAULT_INDEX_EXCLUDE_GLOBS, ...configured])].join(',')}}`;
}
