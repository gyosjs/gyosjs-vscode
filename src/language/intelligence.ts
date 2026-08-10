import * as vscode from 'vscode';
import { attributeAtOffset, elementAtOffset, getAttribute, scanTemplate, type AttributeToken, type ElementToken } from './scanner';
import { identifierAt } from './symbols';
import { scanContextAccesses, scanGyosCalls } from './symbols';
import { type IndexedFile, type IndexedSymbol, WorkspaceIndex } from './workspace-index';
import { BUILTIN_PIPES, CONTEXT_APIS, FORM_CONTEXT_METHODS, GYOS_APIS, findContextApi, findGyosApi, type RuntimeApiDefinition } from './api';

export const SEMANTIC_LEGEND = new vscode.SemanticTokensLegend(
  ['class', 'property', 'method', 'variable', 'function'],
  ['declaration', 'defaultLibrary']
);

const EXPRESSION_ATTRIBUTES = new Set([
  'g-init', 'g-effect', 'g-show', 'g-text', 'g-html', 'g-model', 'g-validate', 'g-submit',
  'g-key', 'g-router-params', '*if', '*elseif', '*for', '*switch', '*case', '*await'
]);
const JS_WORDS = new Set([
  'true', 'false', 'null', 'undefined', 'this', 'new', 'return', 'typeof', 'instanceof', 'in',
  'if', 'else', 'await', 'async', 'const', 'let', 'var', 'function', 'Math', 'Date', 'JSON', 'Object',
  'Array', 'String', 'Number', 'Boolean', 'console'
]);

function documentFile(document: vscode.TextDocument, index: WorkspaceIndex): IndexedFile {
  return index.updateDocument(document);
}

function scopeContainer(element: ElementToken | null): string | null {
  let current = element;
  while (current) {
    const scope = getAttribute(current, 'g-scope');
    if (scope) {
      const value = scope.value?.trim();
      return value && !value.startsWith('{') ? value : `@${current.start}`;
    }
    if (current.attributes.some(attribute => /^(?:gd|gm)-/i.test(attribute.name))) return `@${current.start}`;
    current = current.parent;
  }
  return null;
}

function ownsOffset(element: ElementToken, offset: number): boolean {
  return offset >= element.start && offset <= element.openEnd;
}

function isAncestor(candidate: ElementToken, element: ElementToken): boolean {
  let current: ElementToken | null = element;
  while (current) {
    if (current === candidate) return true;
    current = current.parent;
  }
  return false;
}

function visibleSymbols(file: IndexedFile, element: ElementToken | null, index: WorkspaceIndex): IndexedSymbol[] {
  if (!element || !file.scan) return [];
  const container = scopeContainer(element);
  const result = container
    ? [...(container.startsWith('@')
      ? file.symbols.filter(symbol => symbol.container === container && (symbol.kind === 'property' || symbol.kind === 'method'))
      : [
        ...index.members(container),
        ...file.symbols.filter(symbol => symbol.container === container && (symbol.kind === 'property' || symbol.kind === 'method'))
      ])]
    : [];
  for (const symbol of file.symbols) {
    if (symbol.kind === 'ref' && symbol.container === container) result.push(symbol);
    if (symbol.kind === 'form' && symbol.container === container) result.push(symbol);
    if (symbol.kind !== 'alias') continue;
    const owner = file.scan.elements.find(candidate => ownsOffset(candidate, symbol.start));
    if (owner && isAncestor(owner, element)) result.push(symbol);
  }
  const unique = new Map<string, IndexedSymbol>();
  for (const symbol of result) unique.set(`${symbol.kind}:${symbol.name}`, symbol);
  return [...unique.values()];
}

function expressionAttribute(attribute: AttributeToken): boolean {
  const name = attribute.name.toLowerCase();
  return name.startsWith('@') || name.startsWith(':') || name.startsWith('gd-') || name.startsWith('gm-') || name.startsWith('g-on:')
    || name.startsWith('g-model.') || EXPRESSION_ATTRIBUTES.has(name)
    || (name === 'g-scope' && Boolean(attribute.value?.trim().startsWith('{')));
}

function apiMarkdown(definition: RuntimeApiDefinition): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(definition.signature, 'javascript');
  markdown.appendMarkdown(`${definition.description}\n\n[GyosJS documentation](https://github.com/gyosjs/gyosjs/tree/main/docs/en/${definition.docs})`);
  return markdown;
}

function callArgumentHover(call: ReturnType<typeof scanGyosCalls>[number]): vscode.MarkdownString | null {
  if (!call.argument) return null;
  if (['provide', 'inject', '$provide', '$inject'].includes(call.method)) {
    return new vscode.MarkdownString(`GyosJS dependency key \`${call.argument}\`. Use Find References to see matching providers and injections.`);
  }
  if (['emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method)) {
    return new vscode.MarkdownString(`GyosJS event channel \`${call.argument}\`. Use Find References to see emitters and listeners.`);
  }
  return null;
}

function scriptSliceAt(file: IndexedFile, offset: number): { source: string; base: number } | null {
  if (!file.scan) return null;
  const script = file.scan.elements.find(element => element.tagName === 'script' && offset >= element.openEnd && offset <= element.end);
  if (!script) return null;
  const close = file.source.toLowerCase().lastIndexOf('</script', script.end);
  const end = close >= script.openEnd ? close : script.end;
  return { source: file.source.slice(script.openEnd, end), base: script.openEnd };
}

function activeScriptContainer(file: IndexedFile, offset: number): string | undefined {
  return file.symbols.find(symbol => symbol.container && symbol.containerStart !== undefined && symbol.containerEnd !== undefined
    && offset >= symbol.containerStart && offset <= symbol.containerEnd)?.container;
}

function insideInterpolation(source: string, offset: number): boolean {
  const open = source.lastIndexOf('{', offset);
  const closeBefore = source.lastIndexOf('}', offset);
  const closeAfter = source.indexOf('}', offset);
  if (open === -1 || open < closeBefore || closeAfter === -1) return false;
  return source[open + 1] !== '{' && source[open - 1] !== '{';
}

function symbolLocation(symbol: IndexedSymbol, index: WorkspaceIndex): vscode.Location {
  const file = index.file(symbol.uri);
  const start = file ? positionAt(file.source, symbol.start) : new vscode.Position(0, 0);
  const end = file ? positionAt(file.source, symbol.end) : start;
  return new vscode.Location(symbol.uri, new vscode.Range(start, end));
}

function positionAt(source: string, offset: number): vscode.Position {
  let line = 0;
  let lineStart = 0;
  for (let cursor = 0; cursor < offset && cursor < source.length; cursor++) {
    if (source[cursor] === '\n') {
      line++;
      lineStart = cursor + 1;
    }
  }
  return new vscode.Position(line, Math.max(0, offset - lineStart));
}

function definitionsForToken(
  document: vscode.TextDocument,
  file: IndexedFile,
  index: WorkspaceIndex,
  element: ElementToken | null,
  name: string,
  tokenStart: number
): IndexedSymbol[] {
  const source = document.getText();
  const before = source.slice(Math.max(0, tokenStart - 24), tokenStart);
  if (name === '$index') {
    let current = element;
    while (current) {
      const loop = getAttribute(current, '*for');
      if (loop) return [{ uri: file.uri, name, kind: 'alias', start: loop.nameStart, end: loop.nameEnd, role: 'declaration' }];
      current = current.parent;
    }
  }
  if (name === '$event') {
    let current = element;
    while (current) {
      const event = current.attributes.find(attribute => attribute.name.startsWith('@'));
      if (event) return [{ uri: file.uri, name, kind: 'event', start: event.nameStart, end: event.nameEnd, role: 'declaration' }];
      current = current.parent;
    }
  }
  if (/\$refs\s*\.\s*$/.test(before)) return file.symbols.filter(symbol => symbol.kind === 'ref' && symbol.name === name && symbol.role !== 'reference' && symbol.container === scopeContainer(element));
  if (/\$store\s*\.\s*$/.test(before)) return index.definitions('store', name);
  if (/(?:\$|Gyos\s*\.\s*)inject\s*\(\s*['"]$/.test(before)) {
    const local = file.symbols.filter(symbol => symbol.kind === 'provider' && symbol.name === name && symbol.role !== 'reference');
    return local.length ? local : index.definitions('provider', name);
  }
  if (/(?:\$|Gyos\s*\.\s*)(?:emit|on)\s*\(\s*['"]$/.test(before)) return index.symbols('event').filter(symbol => symbol.name === name);
  if (/\|\s*$/.test(before)) return index.definitions('pipe', name);
  if (FORM_CONTEXT_METHODS.some(definition => definition.name === name)) {
    const owner = /([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(before)?.[1];
    if (owner) return file.symbols.filter(symbol => symbol.kind === 'form' && symbol.name === owner);
  }
  const local = visibleSymbols(file, element, index).filter(symbol => symbol.name === name);
  return local.length ? local : [];
}

function valueToken(attribute: AttributeToken, offset: number): { name: string; start: number; end: number } | null {
  if (attribute.valueStart === null || attribute.valueEnd === null) return null;
  const local = identifierAt(attribute.value ?? '', offset - attribute.valueStart);
  return local ? { ...local, start: local.start + attribute.valueStart, end: local.end + attribute.valueStart } : null;
}

function literalValueAt(attribute: AttributeToken, offset: number): boolean {
  return attribute.valueStart !== null && attribute.valueEnd !== null && offset >= attribute.valueStart && offset <= attribute.valueEnd;
}

function linkedCallSymbols(file: IndexedFile, index: WorkspaceIndex, source: string, base: number, offset: number): IndexedSymbol[] {
  const call = scanGyosCalls(source, base).find(candidate =>
    (offset >= candidate.methodStart && offset <= candidate.methodEnd)
    || (candidate.argumentStart !== undefined && candidate.argumentEnd !== undefined && offset >= candidate.argumentStart && offset <= candidate.argumentEnd));
  if (!call?.argument || call.argumentStart === undefined) return [];
  if (['inject', '$inject'].includes(call.method)) {
    const container = activeScriptContainer(file, offset);
    const local = file.symbols.filter(symbol => symbol.kind === 'provider' && symbol.name === call.argument && symbol.role !== 'reference');
    const scoped = container ? local.filter(symbol => symbol.container === container) : [];
    return scoped.length ? scoped : local.length ? local : index.definitions('provider', call.argument);
  }
  if (['emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method)) return index.symbols('event').filter(symbol => symbol.name === call.argument);
  if (call.method === '$watch') {
    const container = activeScriptContainer(file, offset);
    const root = call.argument.split(/[.[\]]/)[0];
    return container ? index.members(container).filter(symbol => symbol.name === root) : [];
  }
  return [];
}

export function resolveStaticHtmlUri(base: vscode.Uri, value: string): vscode.Uri | null {
  if (!value || /^(?:https?:|mailto:|tel:|javascript:|#)/i.test(value) || /[{}$]/.test(value)) return null;
  const clean = value.split(/[?#]/)[0];
  if (!/\.html?$/i.test(clean)) return null;
  if (clean.startsWith('/')) {
    const folder = vscode.workspace.getWorkspaceFolder(base) ?? vscode.workspace.workspaceFolders?.[0];
    return folder ? vscode.Uri.joinPath(folder.uri, clean.slice(1)) : null;
  }
  const slash = base.path.lastIndexOf('/');
  return vscode.Uri.joinPath(base.with({ path: base.path.slice(0, slash + 1) }), clean);
}

function hasBoostContext(element: ElementToken): boolean {
  let current: ElementToken | null = element;
  while (current) {
    if (getAttribute(current, 'g-boost')) return true;
    if (getAttribute(current, 'g-no-boost')) return false;
    current = current.parent;
  }
  return false;
}

export class GyosDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Definition | null {
    const offset = document.offsetAt(position);
    const file = documentFile(document, this.index);
    const scan = file.scan ?? scanTemplate(document.getText());
    const context = attributeAtOffset(scan, offset);
    const element = context?.element ?? elementAtOffset(scan, offset);
    let symbols: IndexedSymbol[] = [];

    const script = scriptSliceAt(file, offset);
    if (script) {
      symbols = linkedCallSymbols(file, this.index, script.source, script.base, offset);
      const access = scanContextAccesses(script.source, script.base).find(candidate => candidate.memberStart !== undefined && offset >= candidate.memberStart && offset <= candidate.memberEnd!);
      if (access?.name === '$refs' && access.member) {
        const container = activeScriptContainer(file, offset);
        symbols = file.symbols.filter(symbol => symbol.kind === 'ref' && symbol.role !== 'reference' && symbol.name === access.member && (!container || symbol.container === container));
      }
      return symbols.length ? symbols.map(symbol => symbolLocation(symbol, this.index)) : null;
    }

    if (context && literalValueAt(context.attribute, offset)) {
      const name = context.attribute.name.toLowerCase();
      const value = context.attribute.value?.trim() ?? '';
      if (name === 'g-scope' && !value.startsWith('{')) symbols = this.index.definitions('scope', value);
      else if (name === 'g-scope' && value.startsWith('{')) {
        symbols = linkedCallSymbols(file, this.index, context.attribute.value ?? '', context.attribute.valueStart ?? 0, offset);
        const token = valueToken(context.attribute, offset);
        if (!symbols.length && token) symbols = definitionsForToken(document, file, this.index, element, token.name, token.start);
      }
      else if ((name === 'g-target' || name === 'g-portal') && value.startsWith('#')) symbols = file.symbols.filter(symbol => symbol.kind === 'id' && symbol.name === value.slice(1));
      else if (name === 'g-persist') symbols = this.index.definitions('persist', value);
      else if (name === 'g-transition' || name.startsWith('g-transition.')) {
        const transitionName = value.replace(/^['"]|['"]$/g, '');
        symbols = this.index.definitions('transition', transitionName);
        if (!symbols.length) {
          const token = valueToken(context.attribute, offset);
          if (token) symbols = definitionsForToken(document, file, this.index, element, token.name, token.start);
        }
      }
      else if (name === 'g-form' || name === 'g-errors') symbols = file.symbols.filter(symbol => symbol.kind === 'form' && symbol.name === value);
      else if (name === 'g-validate') {
        const token = valueToken(context.attribute, offset);
        if (token) symbols = this.index.definitions('validator', token.name);
      } else if (name === 'g-router-link' || (name === 'href' && element && hasBoostContext(element))) {
        const target = resolveStaticHtmlUri(document.uri, value);
        if (target && this.index.file(target)) return new vscode.Location(target, new vscode.Position(0, 0));
      } else if (name === 'g-provide') {
        const token = valueToken(context.attribute, offset);
        if (token) symbols = file.symbols.filter(symbol => symbol.kind === 'provider' && symbol.name === token.name && symbol.role !== 'reference');
      } else if (expressionAttribute(context.attribute)) {
        symbols = linkedCallSymbols(file, this.index, context.attribute.value ?? '', context.attribute.valueStart ?? 0, offset);
        const token = valueToken(context.attribute, offset);
        if (!symbols.length && token) symbols = definitionsForToken(document, file, this.index, element, token.name, token.start);
      }
    } else if (context && context.attribute.name.toLowerCase().startsWith('g-on:')) {
      const eventName = context.attribute.name.slice(5);
      symbols = this.index.symbols('event').filter(symbol => symbol.name === eventName && !(symbol.uri.toString() === document.uri.toString() && symbol.start === context.attribute.nameStart + 5));
    } else if (context && context.attribute.name.toLowerCase().startsWith('g-')) {
      const directive = context.attribute.name.slice(2).split('.')[0];
      symbols = this.index.definitions('directive', directive);
    } else if (insideInterpolation(document.getText(), offset)) {
      const token = identifierAt(document.getText(), offset);
      if (token) {
        symbols = definitionsForToken(document, file, this.index, element, token.name, token.start);
      }
    }
    return symbols.length ? symbols.map(symbol => symbolLocation(symbol, this.index)) : null;
  }
}

export class GyosReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext): vscode.Location[] {
    const offset = document.offsetAt(position);
    const file = documentFile(document, this.index);
    const indexedSymbol = file.symbols.find(symbol => offset >= symbol.start && offset <= symbol.end);
    if (indexedSymbol && ['provider', 'event', 'ref', 'form'].includes(indexedSymbol.kind)) {
      let matches = this.index.symbols(indexedSymbol.kind).filter(symbol => symbol.name === indexedSymbol.name);
      if (indexedSymbol.kind === 'ref') {
        matches = matches.filter(symbol => symbol.uri.toString() === document.uri.toString()
          && (!indexedSymbol.container || !symbol.container || symbol.container === indexedSymbol.container));
      }
      if (!context.includeDeclaration) matches = matches.filter(symbol => symbol.role === 'reference');
      return matches.map(symbol => symbolLocation(symbol, this.index));
    }
    const attributeContext = file.scan ? attributeAtOffset(file.scan, offset) : null;
    if (!attributeContext) return [];
    const attribute = attributeContext.attribute;
    const value = attribute.value?.trim();
    if (!value) return [];
    const locations: vscode.Location[] = [];
    if (attribute.name.toLowerCase() === 'id') {
      for (const candidate of file.scan?.elements ?? []) {
        for (const target of candidate.attributes.filter(item => ['g-target', 'g-portal'].includes(item.name.toLowerCase()) && item.value === `#${value}`)) {
          if (target.valueStart !== null) locations.push(new vscode.Location(document.uri, new vscode.Range(document.positionAt(target.valueStart + 1), document.positionAt(target.valueEnd ?? target.valueStart + 1))));
        }
      }
      if (context.includeDeclaration) {
        const declaration = file.symbols.find(symbol => symbol.kind === 'id' && symbol.name === value);
        if (declaration) locations.unshift(symbolLocation(declaration, this.index));
      }
    }
    if (attribute.name.toLowerCase() === 'g-persist') {
      const definitions = this.index.definitions('persist', value);
      for (const definition of definitions) {
        if (context.includeDeclaration || definition.uri.toString() !== document.uri.toString() || definition.start !== attribute.valueStart) {
          locations.push(symbolLocation(definition, this.index));
        }
      }
    }
    return locations;
  }
}

function tokenType(symbol: IndexedSymbol): number {
  if (symbol.kind === 'scope') return 0;
  if (symbol.kind === 'property' || symbol.kind === 'ref') return 1;
  if (symbol.kind === 'method') return 2;
  if (symbol.kind === 'pipe' || symbol.kind === 'validator') return 4;
  return 3;
}

function expressionRanges(file: IndexedFile): Array<{ start: number; end: number; element: ElementToken }> {
  const ranges: Array<{ start: number; end: number; element: ElementToken }> = [];
  if (!file.scan) return ranges;
  for (const element of file.scan.elements) {
    if (element.ignored) continue;
    for (const attribute of element.attributes) {
      if (expressionAttribute(attribute) && attribute.valueStart !== null && attribute.valueEnd !== null) {
        ranges.push({ start: attribute.valueStart, end: attribute.valueEnd, element });
      }
    }
  }
  const interpolation = /\{(?!\{)([^{}]+)\}/g;
  for (const match of file.source.matchAll(interpolation)) {
    const start = (match.index ?? 0) + 1;
    const element = elementAtOffset(file.scan, start);
    const attribute = file.scan ? attributeAtOffset(file.scan, start) : null;
    if (element && !element.ignored && element.tagName !== 'script' && element.tagName !== 'style' && !attribute && !ranges.some(range => start >= range.start && start <= range.end)) {
      ranges.push({ start, end: start + match[1].length, element });
    }
  }
  return ranges;
}

export class GyosSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const file = documentFile(document, this.index);
    const builder = new vscode.SemanticTokensBuilder(SEMANTIC_LEGEND);
    const tokens: Array<{ start: number; end: number; type: string; modifiers?: string[] }> = [];
    if (!file.scan) return builder.build();
    for (const element of file.scan.elements) {
      const scope = getAttribute(element, 'g-scope');
      if (scope && scope.valueStart !== null && scope.value && !scope.value.trim().startsWith('{')) {
        const value = scope.value.trim();
        const start = scope.valueStart + scope.value.indexOf(value);
        tokens.push({ start, end: start + value.length, type: 'class' });
      }
      const transition = element.attributes.find(attribute => attribute.name.toLowerCase().startsWith('g-transition'));
      if (transition?.value && transition.valueStart !== null) {
        const raw = transition.value.trim();
        const unwrapped = raw.replace(/^\{\s*|\s*\}$/g, '').replace(/^['"]|['"]$/g, '');
        const relative = transition.value.indexOf(unwrapped);
        const member = visibleSymbols(file, element, this.index).find(symbol => symbol.name === unwrapped);
        const known = ['fade', 'slide-down', 'slide-up', 'slide-left', 'slide-right', 'scale', 'zoom'].includes(unwrapped)
          || this.index.definitions('transition', unwrapped).length > 0;
        if (unwrapped && (member || known)) {
          tokens.push({
            start: transition.valueStart + relative,
            end: transition.valueStart + relative + unwrapped.length,
            type: member && !/^['"]/.test(raw) ? SEMANTIC_LEGEND.tokenTypes[tokenType(member)] : 'function'
          });
        }
      }
      const validate = getAttribute(element, 'g-validate');
      if (validate?.value && validate.valueStart !== null) {
        for (const match of validate.value.matchAll(/[A-Za-z_$][\w$]*/g)) {
          const start = validate.valueStart + (match.index ?? 0);
          tokens.push({ start, end: start + match[0].length, type: 'function' });
        }
      }
    }
    for (const symbol of file.symbols.filter(symbol => symbol.role !== 'reference' && ['alias', 'provider', 'event', 'form'].includes(symbol.kind))) {
      tokens.push({
        start: symbol.start,
        end: symbol.end,
        type: symbol.kind === 'event' ? 'function' : 'variable',
        modifiers: ['declaration']
      });
    }
    for (const element of file.scan.elements.filter(candidate => candidate.tagName === 'script')) {
      const script = scriptSliceAt(file, element.openEnd);
      if (!script) continue;
      for (const call of scanGyosCalls(script.source, script.base)) {
        if (call.owner === 'gyos' && findGyosApi(call.method)) tokens.push({ start: call.methodStart, end: call.methodEnd, type: 'function', modifiers: ['defaultLibrary'] });
        if (call.owner === 'context' && findContextApi(call.method)) tokens.push({ start: call.methodStart, end: call.methodEnd, type: 'method', modifiers: ['defaultLibrary'] });
        if (call.argumentStart !== undefined && call.argumentEnd !== undefined && ['provide', 'inject', '$provide', '$inject', 'emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method)) {
          tokens.push({ start: call.argumentStart, end: call.argumentEnd, type: call.method.includes('emit') || ['on', 'once', 'off', '$on'].includes(call.method) ? 'function' : 'variable' });
        }
      }
      for (const access of scanContextAccesses(script.source, script.base)) {
        tokens.push({ start: access.start, end: access.end, type: access.name === '$refs' ? 'variable' : 'method', modifiers: ['defaultLibrary'] });
        if (access.memberStart !== undefined && access.memberEnd !== undefined) tokens.push({ start: access.memberStart, end: access.memberEnd, type: 'property' });
      }
    }
    for (const range of expressionRanges(file)) {
      const visible = visibleSymbols(file, range.element, this.index);
      const byName = new Map(visible.map(symbol => [symbol.name, symbol]));
      const expression = file.source.slice(range.start, range.end);
      for (const call of scanGyosCalls(expression, range.start)) {
        if (call.owner === 'gyos' && findGyosApi(call.method)) tokens.push({ start: call.methodStart, end: call.methodEnd, type: 'function', modifiers: ['defaultLibrary'] });
        if (call.owner === 'context' && findContextApi(call.method)) tokens.push({ start: call.methodStart, end: call.methodEnd, type: 'method', modifiers: ['defaultLibrary'] });
        if (call.argumentStart !== undefined && call.argumentEnd !== undefined && ['provide', 'inject', '$provide', '$inject', 'emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method)) {
          tokens.push({ start: call.argumentStart, end: call.argumentEnd, type: ['emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method) ? 'function' : 'variable' });
        }
      }
      for (const match of expression.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const name = match[0];
        const start = range.start + (match.index ?? 0);
        const before = expression.slice(Math.max(0, (match.index ?? 0) - 20), match.index ?? 0);
        if (name.startsWith('$')) {
          const context = findContextApi(name);
          tokens.push({ start, end: start + name.length, type: context && context.signature.includes('(') ? 'method' : 'variable', modifiers: ['defaultLibrary'] });
          continue;
        }
        if (JS_WORDS.has(name)) continue;
        if (/\|\s*$/.test(before) && (BUILTIN_PIPES.includes(name as typeof BUILTIN_PIPES[number]) || this.index.definitions('pipe', name).length)) {
          tokens.push({ start, end: start + name.length, type: 'function' });
          continue;
        }
        if (/\$store\s*\.\s*$/.test(before) && this.index.definitions('store', name).length) {
          tokens.push({ start, end: start + name.length, type: 'variable' });
          continue;
        }
        const symbol = byName.get(name);
        if (symbol) tokens.push({ start, end: start + name.length, type: SEMANTIC_LEGEND.tokenTypes[tokenType(symbol)] });
      }
    }
    const uniqueTokens = new Map<string, typeof tokens[number]>();
    for (const token of tokens) {
      const key = `${token.start}:${token.end}`;
      const previous = uniqueTokens.get(key);
      if (!previous || token.modifiers?.includes('declaration')) uniqueTokens.set(key, token);
    }
    for (const token of [...uniqueTokens.values()].sort((left, right) => left.start - right.start || left.end - right.end)) {
      builder.push(new vscode.Range(document.positionAt(token.start), document.positionAt(token.end)), token.type, token.modifiers);
    }
    return builder.build();
  }
}

export function contextualCompletions(document: vscode.TextDocument, position: vscode.Position, index: WorkspaceIndex): vscode.CompletionItem[] {
  const offset = document.offsetAt(position);
  const file = documentFile(document, index);
  if (!file.scan) return [];
  const prefix = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));
  const script = scriptSliceAt(file, offset);
  if (script) {
    if (/\bGyos\s*\.\s*[\w$]*$/.test(prefix)) {
      return GYOS_APIS.map(definition => apiCompletion(definition, vscode.CompletionItemKind.Function));
    }
    if (/(?:\bthis\s*\.\s*)?\$refs\s*\.\s*[\w$]*$/.test(prefix)) {
      const container = activeScriptContainer(file, offset);
      return uniqueSymbolCompletions(file.symbols.filter(symbol => symbol.kind === 'ref' && symbol.role !== 'reference' && (!container || symbol.container === container)), vscode.CompletionItemKind.Reference);
    }
    if (/(?:Gyos\s*\.\s*inject|(?:\bthis\s*\.\s*)?\$inject)\s*\(\s*['"][^'"]*$/.test(prefix)) return providerCompletions(index);
    if (/(?:Gyos\s*\.\s*(?:emit|on|once|off)|(?:\bthis\s*\.\s*)?\$(?:emit|on))\s*\(\s*['"][^'"]*$/.test(prefix)) return eventCompletions(index);
    if (/(?:\bthis\s*\.\s*)?\$watch\s*\(\s*['"][^'"]*$/.test(prefix)) {
      const container = activeScriptContainer(file, offset);
      return container ? uniqueSymbolCompletions(index.members(container), vscode.CompletionItemKind.Property) : [];
    }
    if (/(?:\bthis\s*\.\s*)?\$[\w$]*$/.test(prefix)) return CONTEXT_APIS.map(definition => apiCompletion(definition, vscode.CompletionItemKind.Method));
    return [];
  }
  const context = attributeAtOffset(file.scan, offset);
  const element = context?.element ?? elementAtOffset(file.scan, offset);
  if (/\bGyos\s*\.\s*[\w$]*$/.test(prefix)) return GYOS_APIS.map(definition => apiCompletion(definition, vscode.CompletionItemKind.Function));
  if (context && context.attribute.valueStart !== null && context.attribute.valueEnd !== null) {
    const name = context.attribute.name.toLowerCase();
    if (name === 'g-scope' && !context.attribute.value?.trim().startsWith('{')) {
      return uniqueSymbolCompletions(index.symbols('scope'), vscode.CompletionItemKind.Class);
    }
    if (name === 'g-target' || name === 'g-portal') {
      return file.symbols.filter(symbol => symbol.kind === 'id').map(symbol => new vscode.CompletionItem(`#${symbol.name}`, vscode.CompletionItemKind.Reference));
    }
    if (name === 'g-persist') {
      const keys = new Set(index.allFiles().flatMap(candidate => candidate.symbols.filter(symbol => symbol.kind === 'persist').map(symbol => symbol.name)));
      return [...keys].map(key => new vscode.CompletionItem(key, vscode.CompletionItemKind.Reference));
    }
    if (name === 'g-transition' || name.startsWith('g-transition.')) {
      return uniqueSymbolCompletions(index.symbols('transition'), vscode.CompletionItemKind.Function);
    }
    if (name === 'g-validate') {
      return uniqueSymbolCompletions(index.symbols('validator'), vscode.CompletionItemKind.Function);
    }
    if (name === 'g-router-link' || (name === 'href' && element && hasBoostContext(element))) {
      const routes = index.allFiles().filter(candidate => /\.html?$/i.test(candidate.uri.path));
      return routes.map(candidate => {
        const relative = vscode.workspace.asRelativePath(candidate.uri, false).replaceAll('\\', '/');
        const item = new vscode.CompletionItem(`/${relative}`, vscode.CompletionItemKind.File);
        item.detail = 'GyosJS static MPA route';
        return item;
      });
    }
    if (!expressionAttribute(context.attribute)) return [];
  } else if (!insideInterpolation(document.getText(), offset)) return [];

  if (/\|\s*[\w$-]*$/.test(prefix)) {
    const custom = uniqueSymbolCompletions(index.symbols('pipe'), vscode.CompletionItemKind.Function);
    const existing = new Set(custom.map(item => String(item.label)));
    return [...custom, ...BUILTIN_PIPES.filter(name => !existing.has(name)).map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Function))];
  }
  if (/\$refs\s*\.\s*[\w$]*$/.test(prefix)) {
    return uniqueSymbolCompletions(file.symbols.filter(symbol => symbol.kind === 'ref' && symbol.role !== 'reference' && symbol.container === scopeContainer(element)), vscode.CompletionItemKind.Reference);
  }
  if (/(?:Gyos\s*\.\s*inject|\$inject)\s*\(\s*['"][^'"]*$/.test(prefix)) return providerCompletions(index);
  if (/(?:Gyos\s*\.\s*(?:emit|on|once|off)|\$(?:emit|on))\s*\(\s*['"][^'"]*$/.test(prefix)) return eventCompletions(index);
  if (/\$watch\s*\(\s*['"][^'"]*$/.test(prefix)) return uniqueSymbolCompletions(visibleSymbols(file, element, index), vscode.CompletionItemKind.Property);
  const visibleItems = visibleSymbols(file, element, index).map(symbol => {
    const item = new vscode.CompletionItem(symbol.name, symbol.kind === 'method' ? vscode.CompletionItemKind.Method : symbol.kind === 'ref' ? vscode.CompletionItemKind.Reference : vscode.CompletionItemKind.Property);
    item.detail = `${symbol.container ?? 'GyosJS'} ${symbol.kind}`;
    if (symbol.kind === 'method') item.insertText = new vscode.SnippetString(`${symbol.name}($1)`);
    return item;
  });
  const contextItems = CONTEXT_APIS.map(definition => apiCompletion(definition, vscode.CompletionItemKind.Method));
  const formItems = /[A-Za-z_$][\w$]*\s*\.\s*[\w$]*$/.test(prefix)
    ? FORM_CONTEXT_METHODS.map(definition => apiCompletion(definition, vscode.CompletionItemKind.Method))
    : [];
  return [...visibleItems, ...contextItems, ...formItems];
}

function apiCompletion(definition: RuntimeApiDefinition, kind: vscode.CompletionItemKind): vscode.CompletionItem {
  const item = new vscode.CompletionItem(definition.name, kind);
  item.detail = definition.signature;
  item.documentation = apiMarkdown(definition);
  return item;
}

function providerCompletions(index: WorkspaceIndex): vscode.CompletionItem[] {
  const unique = new Map<string, IndexedSymbol>();
  for (const symbol of index.symbols('provider').filter(candidate => candidate.role !== 'reference')) unique.set(symbol.name, symbol);
  return [...unique.values()].map(symbol => new vscode.CompletionItem(symbol.name, vscode.CompletionItemKind.Variable));
}

function eventCompletions(index: WorkspaceIndex): vscode.CompletionItem[] {
  const names = new Set(index.symbols('event').map(symbol => symbol.name));
  return [...names].map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Event));
}

function uniqueSymbolCompletions(symbols: readonly IndexedSymbol[], kind: vscode.CompletionItemKind): vscode.CompletionItem[] {
  const unique = new Map<string, IndexedSymbol>();
  for (const symbol of symbols) unique.set(symbol.name, symbol);
  return [...unique.values()].map(symbol => {
    const item = new vscode.CompletionItem(symbol.name, kind);
    item.detail = `GyosJS ${symbol.kind}`;
    return item;
  });
}

export function symbolHover(document: vscode.TextDocument, position: vscode.Position, index: WorkspaceIndex): vscode.Hover | null {
  const offset = document.offsetAt(position);
  const file = documentFile(document, index);
  const script = scriptSliceAt(file, offset);
  if (script) {
    const calls = scanGyosCalls(script.source, script.base);
    const methodCall = calls.find(candidate => offset >= candidate.methodStart && offset <= candidate.methodEnd);
    if (methodCall) {
      const definition = methodCall.owner === 'gyos' ? findGyosApi(methodCall.method) : findContextApi(methodCall.method);
      if (definition) return new vscode.Hover(apiMarkdown(definition), new vscode.Range(document.positionAt(methodCall.methodStart), document.positionAt(methodCall.methodEnd)));
    }
    const argumentCall = calls.find(candidate => candidate.argumentStart !== undefined && candidate.argumentEnd !== undefined && offset >= candidate.argumentStart && offset <= candidate.argumentEnd);
    if (argumentCall) {
      const markdown = callArgumentHover(argumentCall);
      if (markdown) return new vscode.Hover(markdown, new vscode.Range(document.positionAt(argumentCall.argumentStart!), document.positionAt(argumentCall.argumentEnd!)));
    }
    const access = scanContextAccesses(script.source, script.base).find(candidate => offset >= candidate.start && offset <= candidate.end);
    if (access) {
      const definition = findContextApi(access.name);
      if (definition) return new vscode.Hover(apiMarkdown(definition), new vscode.Range(document.positionAt(access.start), document.positionAt(access.end)));
    }
  }
  const element = file.scan ? elementAtOffset(file.scan, offset) : null;
  const attributeContext = file.scan ? attributeAtOffset(file.scan, offset) : null;
  if (attributeContext?.attribute.value && attributeContext.attribute.valueStart !== null) {
    const calls = scanGyosCalls(attributeContext.attribute.value, attributeContext.attribute.valueStart);
    const methodCall = calls.find(candidate => offset >= candidate.methodStart && offset <= candidate.methodEnd);
    if (methodCall) {
      const definition = methodCall.owner === 'gyos' ? findGyosApi(methodCall.method) : findContextApi(methodCall.method);
      if (definition) return new vscode.Hover(apiMarkdown(definition), new vscode.Range(document.positionAt(methodCall.methodStart), document.positionAt(methodCall.methodEnd)));
    }
    const argumentCall = calls.find(candidate => candidate.argumentStart !== undefined && candidate.argumentEnd !== undefined && offset >= candidate.argumentStart && offset <= candidate.argumentEnd);
    if (argumentCall) {
      const markdown = callArgumentHover(argumentCall);
      if (markdown) return new vscode.Hover(markdown, new vscode.Range(document.positionAt(argumentCall.argumentStart!), document.positionAt(argumentCall.argumentEnd!)));
    }
  }
  if (!attributeContext && insideInterpolation(file.source, offset)) {
    const open = file.source.lastIndexOf('{', offset);
    const close = file.source.indexOf('}', offset);
    if (open !== -1 && close !== -1) {
      const calls = scanGyosCalls(file.source.slice(open + 1, close), open + 1);
      const methodCall = calls.find(candidate => offset >= candidate.methodStart && offset <= candidate.methodEnd);
      if (methodCall) {
        const definition = methodCall.owner === 'gyos' ? findGyosApi(methodCall.method) : findContextApi(methodCall.method);
        if (definition) return new vscode.Hover(apiMarkdown(definition), new vscode.Range(document.positionAt(methodCall.methodStart), document.positionAt(methodCall.methodEnd)));
      }
      const argumentCall = calls.find(candidate => candidate.argumentStart !== undefined && candidate.argumentEnd !== undefined && offset >= candidate.argumentStart && offset <= candidate.argumentEnd);
      if (argumentCall) {
        const markdown = callArgumentHover(argumentCall);
        if (markdown) return new vscode.Hover(markdown, new vscode.Range(document.positionAt(argumentCall.argumentStart!), document.positionAt(argumentCall.argumentEnd!)));
      }
    }
  }
  if (attributeContext?.attribute.name.toLowerCase().startsWith('g-on:') && offset <= attributeContext.attribute.nameEnd) {
    const event = attributeContext.attribute.name.slice(5);
    const markdown = new vscode.MarkdownString(`GyosJS event channel \`${event}\`.\n\nConnects \`g-on:${event}\`, \`$emit/$on\`, and \`Gyos.emit/Gyos.on\` usages.`);
    return new vscode.Hover(markdown, new vscode.Range(document.positionAt(attributeContext.attribute.nameStart + 5), document.positionAt(attributeContext.attribute.nameEnd)));
  }
  if (attributeContext && attributeContext.attribute.valueStart !== null && attributeContext.attribute.valueEnd !== null && offset >= attributeContext.attribute.valueStart) {
    const attributeName = attributeContext.attribute.name.toLowerCase();
    const token = valueToken(attributeContext.attribute, offset);
    if (token && attributeName === 'g-validate') {
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(token.name, 'text');
      markdown.appendMarkdown('GyosJS form validator. Built-in validators and custom `Gyos.validator()` registrations use the same rule syntax.');
      return new vscode.Hover(markdown, new vscode.Range(document.positionAt(token.start), document.positionAt(token.end)));
    }
    if (attributeName === 'g-transition' || attributeName.startsWith('g-transition.')) {
      const raw = attributeContext.attribute.value?.trim() ?? '';
      const name = raw.replace(/^\{\s*|\s*\}$/g, '').replace(/^['"]|['"]$/g, '');
      if (name) {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(name, 'text');
        markdown.appendMarkdown('Structural transition name or scope expression. Custom names are registered with `Gyos.registerTransition()`; a numeric modifier sets duration in milliseconds.');
        return new vscode.Hover(markdown);
      }
    }
  }
  const token = identifierAt(document.getText(), offset);
  if (!token) return null;
  const contextDefinition = findContextApi(token.name);
  if (contextDefinition) return new vscode.Hover(apiMarkdown(contextDefinition), new vscode.Range(document.positionAt(token.start), document.positionAt(token.end)));
  const before = document.getText().slice(Math.max(0, token.start - 12), token.start);
  if (/\|\s*$/.test(before) && BUILTIN_PIPES.includes(token.name as typeof BUILTIN_PIPES[number])) {
    return new vscode.Hover(new vscode.MarkdownString(`GyosJS built-in pipe \`${token.name}\`.`), new vscode.Range(document.positionAt(token.start), document.positionAt(token.end)));
  }
  const definitions = definitionsForToken(document, file, index, element, token.name, token.start);
  if (!definitions.length) return null;
  const definition = definitions[0];
  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(`${definition.container ? `${definition.container}.` : ''}${definition.name}`, 'javascript');
  markdown.appendMarkdown(`GyosJS **${definition.detail ?? definition.kind}**`);
  return new vscode.Hover(markdown, new vscode.Range(document.positionAt(token.start), document.positionAt(token.end)));
}
