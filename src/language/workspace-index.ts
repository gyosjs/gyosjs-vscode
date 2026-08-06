import * as vscode from 'vscode';
import { attributeAtOffset, elementAtOffset, getAttribute, scanTemplate, type ElementToken, type TemplateScan } from './scanner';
import {
  scanJavaScriptSymbols,
  scanObjectMembers,
  type GyosSymbol,
  type GyosSymbolKind
} from './symbols';

export interface IndexedSymbol extends GyosSymbol {
  uri: vscode.Uri;
}

export interface IndexedFile {
  uri: vscode.Uri;
  source: string;
  symbols: IndexedSymbol[];
  scan: TemplateScan | null;
}

const TEMPLATE_EXTENSIONS = ['.html', '.htm', '.php'];
const DEFAULT_EXCLUDES = [
  '/.git/', '/node_modules/', '/vendor/', '/dist/', '/build/', '/coverage/',
  '/.cache/', '/.next/', '/.nuxt/', '/public/build/'
];

function isTemplateUri(uri: vscode.Uri): boolean {
  if (uri.scheme === 'untitled') return true;
  const path = uri.path.toLowerCase();
  return TEMPLATE_EXTENSIONS.some(extension => path.endsWith(extension));
}

function attributeSymbol(
  uri: vscode.Uri,
  kind: GyosSymbolKind,
  name: string,
  start: number,
  container?: string
): IndexedSymbol {
  return { uri, kind, name, start, end: start + name.length, container, role: 'declaration' };
}

function jsonRootKeys(value: string): Array<{ name: string; start: number }> {
  const keys: Array<{ name: string; start: number }> = [];
  let depth = 0;
  let cursor = 0;
  while (cursor < value.length) {
    const char = value[cursor];
    if (char === '"') {
      const start = cursor + 1;
      cursor++;
      while (cursor < value.length && value[cursor] !== '"') cursor += value[cursor] === '\\' ? 2 : 1;
      const name = value.slice(start, cursor);
      let after = cursor + 1;
      while (/\s/.test(value[after] ?? '')) after++;
      if (depth === 1 && value[after] === ':') keys.push({ name, start });
    } else if (char === '{') depth++;
    else if (char === '}') depth--;
    cursor++;
  }
  return keys;
}

function autoScopeContainer(element: ElementToken): string {
  let current: ElementToken | null = element;
  while (current) {
    const scope = getAttribute(current, 'g-scope');
    if (scope) {
      const value = scope.value?.trim();
      return value && !value.startsWith('{') ? value : `@${current.start}`;
    }
    if (current.attributes.some(attribute => /^(?:gd|gm)-/i.test(attribute.name))) return `@${current.start}`;
    current = current.parent;
  }
  return '@document';
}

function scanTemplateSymbols(uri: vscode.Uri, source: string, scan: TemplateScan): IndexedSymbol[] {
  const symbols: IndexedSymbol[] = [];
  for (const element of scan.elements) {
    if (element.ignored) continue;
    const scope = getAttribute(element, 'g-scope');
    if (scope?.value && scope.valueStart !== null && scope.value.trim().startsWith('{')) {
      const leading = scope.value.indexOf('{');
      const objectSource = scope.value.slice(leading);
      const members = scanObjectMembers(objectSource, { start: 0, end: objectSource.length }, `@${element.start}`, scope.valueStart + leading);
      symbols.push(...members.map(symbol => ({ ...symbol, uri })));
    }

    for (const attribute of element.attributes) {
      const lower = attribute.name.toLowerCase();
      if (attribute.valueStart !== null && attribute.value) {
        const value = attribute.value.trim();
        const trimOffset = attribute.value.indexOf(value);
        const start = attribute.valueStart + trimOffset;
        if (lower === 'id') symbols.push(attributeSymbol(uri, 'id', value, start));
        if (lower === 'g-ref') symbols.push(attributeSymbol(uri, 'ref', value, start, autoScopeContainer(element)));
        if (lower === 'g-persist') symbols.push(attributeSymbol(uri, 'persist', value, start));
        if (lower === 'g-form') symbols.push(attributeSymbol(uri, 'form', value, start, autoScopeContainer(element)));
        if (lower === 'g-provide') {
          for (const key of jsonRootKeys(attribute.value)) {
            symbols.push(attributeSymbol(uri, 'provider', key.name, attribute.valueStart + key.start, autoScopeContainer(element)));
          }
        }
        if (lower === '*then' || lower === '*catch') {
          if (/^[A-Za-z_$][\w$]*$/.test(value)) symbols.push(attributeSymbol(uri, 'alias', value, start, autoScopeContainer(element)));
        }
        if (lower === '*for') {
          const match = /^\s*([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s+in\b/.exec(attribute.value);
          if (match) {
            for (const alias of match.slice(1).filter((item): item is string => Boolean(item))) {
              const aliasStart = attribute.valueStart + attribute.value.indexOf(alias);
              symbols.push(attributeSymbol(uri, 'alias', alias, aliasStart, autoScopeContainer(element)));
            }
          }
        }
      }
      if (lower.startsWith('g-on:') && lower.length > 5) {
        const name = attribute.name.slice(5);
        symbols.push(attributeSymbol(uri, 'event', name, attribute.nameStart + 5, autoScopeContainer(element)));
      }
      if (lower.startsWith('gd-') && lower.length > 3) {
        const name = attribute.name.slice(3);
        symbols.push(attributeSymbol(uri, 'property', name, attribute.nameStart + 3, `@${element.start}`));
      }
      if (lower.startsWith('gm-') && lower.length > 3) {
        const name = attribute.name.slice(3).split(':')[0];
        symbols.push(attributeSymbol(uri, 'method', name, attribute.nameStart + 3, `@${element.start}`));
      }
      if (attribute.value && attribute.valueStart !== null && (
        lower.startsWith('@') || lower.startsWith(':') || lower.startsWith('g-on:')
        || lower.startsWith('*') || lower.startsWith('gd-') || lower.startsWith('gm-')
        || lower.startsWith('g-model') || lower.startsWith('g-transition')
        || ['g-scope', 'g-show', 'g-text', 'g-html', 'g-key', 'g-tooltip', 'g-markdown', 'g-submit', 'g-router-params'].includes(lower)
      )) {
        symbols.push(...scanJavaScriptSymbols(attribute.value, attribute.valueStart).map(symbol => ({ ...symbol, uri, container: symbol.container ?? autoScopeContainer(element) })));
      }
    }

    if (element.tagName === 'script') {
      const closeStart = source.toLowerCase().lastIndexOf('</script', element.end);
      const scriptEnd = closeStart >= element.openEnd ? closeStart : element.end;
      symbols.push(...scanJavaScriptSymbols(source.slice(element.openEnd, scriptEnd), element.openEnd).map(symbol => ({ ...symbol, uri })));
    }
  }
  for (const match of source.matchAll(/\{(?!\{)([^{}]+)\}/g)) {
    const start = (match.index ?? 0) + 1;
    const element = elementAtOffset(scan, start);
    if (!element || element.tagName === 'script' || element.tagName === 'style' || attributeAtOffset(scan, start)) continue;
    symbols.push(...scanJavaScriptSymbols(match[1], start).map(symbol => ({ ...symbol, uri, container: symbol.container ?? autoScopeContainer(element) })));
  }
  return symbols;
}

export function indexSource(uri: vscode.Uri, source: string): IndexedFile {
  if (!isTemplateUri(uri)) {
    return { uri, source, scan: null, symbols: scanJavaScriptSymbols(source).map(symbol => ({ ...symbol, uri })) };
  }
  const scan = scanTemplate(source);
  return { uri, source, scan, symbols: scanTemplateSymbols(uri, source, scan) };
}

function isExcluded(uri: vscode.Uri, configured: readonly string[]): boolean {
  const path = uri.path.replaceAll('\\', '/').toLowerCase();
  return [...DEFAULT_EXCLUDES, ...configured].some(value => path.includes(value.replaceAll('\\', '/').toLowerCase()));
}

export class WorkspaceIndex implements vscode.Disposable {
  private readonly files = new Map<string, IndexedFile>();
  private readonly disposables: vscode.Disposable[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized || !this.enabled()) return;
    this.initialized = true;
    await this.scanWorkspace();

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{html,htm,php,js,mjs,cjs,ts,mts,cts}');
    this.disposables.push(
      watcher,
      watcher.onDidCreate(uri => void this.updateUri(uri)),
      watcher.onDidChange(uri => void this.updateUri(uri)),
      watcher.onDidDelete(uri => this.remove(uri))
    );
  }

  private async scanWorkspace(): Promise<void> {
    const uris = await vscode.workspace.findFiles(
      '**/*.{html,htm,php,js,mjs,cjs,ts,mts,cts}',
      '**/{.git,node_modules,vendor,dist,build,coverage,.cache,.next,.nuxt}/**',
      5000
    );
    await Promise.all(uris.filter(uri => !this.excluded(uri)).map(uri => this.updateUri(uri)));
  }

  enabled(): boolean {
    return vscode.workspace.getConfiguration('gyosjs').get('indexing.enabled', true);
  }

  private excluded(uri: vscode.Uri): boolean {
    const configured = vscode.workspace.getConfiguration('gyosjs').get<string[]>('indexing.exclude', []);
    return isExcluded(uri, configured);
  }

  updateDocument(document: vscode.TextDocument): void {
    if (!this.enabled() || this.excluded(document.uri)) return;
    this.files.set(document.uri.toString(), indexSource(document.uri, document.getText()));
  }

  async updateUri(uri: vscode.Uri): Promise<void> {
    if (!this.enabled() || this.excluded(uri)) return;
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
    if (open) {
      this.updateDocument(open);
      return;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      this.files.set(uri.toString(), indexSource(uri, new TextDecoder().decode(bytes)));
    } catch {
      this.remove(uri);
    }
  }

  remove(uri: vscode.Uri): void {
    this.files.delete(uri.toString());
  }

  clear(): void {
    this.files.clear();
  }

  async rebuild(): Promise<void> {
    this.clear();
    if (!this.enabled()) return;
    if (!this.initialized) await this.initialize();
    else await this.scanWorkspace();
  }

  file(uri: vscode.Uri): IndexedFile | undefined {
    return this.files.get(uri.toString());
  }

  allFiles(): readonly IndexedFile[] {
    return [...this.files.values()];
  }

  definitions(kind: GyosSymbolKind, name: string, container?: string): IndexedSymbol[] {
    const result: IndexedSymbol[] = [];
    for (const file of this.files.values()) {
      result.push(...file.symbols.filter(symbol => symbol.kind === kind && symbol.name === name && symbol.role !== 'reference' && (!container || symbol.container === container)));
    }
    return result;
  }

  symbols(kind: GyosSymbolKind): IndexedSymbol[] {
    return this.allFiles().flatMap(file => file.symbols.filter(symbol => symbol.kind === kind));
  }

  members(container: string): IndexedSymbol[] {
    const result: IndexedSymbol[] = [];
    for (const file of this.files.values()) {
      result.push(...file.symbols.filter(symbol => symbol.container === container && (symbol.kind === 'property' || symbol.kind === 'method')));
    }
    return result;
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
    this.files.clear();
  }
}
