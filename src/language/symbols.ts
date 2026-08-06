export type GyosSymbolKind =
  | 'scope'
  | 'property'
  | 'method'
  | 'alias'
  | 'ref'
  | 'store'
  | 'provider'
  | 'pipe'
  | 'validator'
  | 'transition'
  | 'directive'
  | 'id'
  | 'persist'
  | 'event'
  | 'form';

export interface GyosSymbol {
  name: string;
  kind: GyosSymbolKind;
  start: number;
  end: number;
  container?: string;
  detail?: string;
  role?: 'declaration' | 'reference';
  containerStart?: number;
  containerEnd?: number;
}

export interface GyosCall {
  owner: 'gyos' | 'context';
  method: string;
  methodStart: number;
  methodEnd: number;
  argument?: string;
  argumentStart?: number;
  argumentEnd?: number;
}

export interface ContextAccess {
  name: string;
  start: number;
  end: number;
  member?: string;
  memberStart?: number;
  memberEnd?: number;
}

const REGISTRATIONS: Record<string, GyosSymbolKind> = {
  scope: 'scope',
  store: 'store',
  provide: 'provider',
  pipe: 'pipe',
  validator: 'validator',
  directive: 'directive',
  registerTransition: 'transition'
};

interface Span {
  start: number;
  end: number;
}

function maskComments(source: string): string {
  const chars = [...source];
  let index = 0;
  let quote: string | null = null;
  while (index < chars.length) {
    const char = chars[index];
    if (quote) {
      if (char === '\\') index += 2;
      else {
        if (char === quote) quote = null;
        index++;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      index++;
      continue;
    }
    if (char === '/' && chars[index + 1] === '/') {
      const start = index;
      while (index < chars.length && chars[index] !== '\n') index++;
      for (let cursor = start; cursor < index; cursor++) chars[cursor] = ' ';
      continue;
    }
    if (char === '/' && chars[index + 1] === '*') {
      const start = index;
      index += 2;
      while (index < chars.length && !(chars[index] === '*' && chars[index + 1] === '/')) index++;
      index = Math.min(chars.length, index + 2);
      for (let cursor = start; cursor < index; cursor++) if (chars[cursor] !== '\n') chars[cursor] = ' ';
      continue;
    }
    index++;
  }
  return chars.join('');
}

function isCodeOffset(source: string, target: number): boolean {
  let quote: string | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < target; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index++;
    } else if (char === '/' && next === '*') {
      blockComment = true;
      index++;
    } else if (char === '"' || char === "'" || char === '`') quote = char;
  }
  return !quote && !lineComment && !blockComment;
}

function skipTrivia(source: string, offset: number): number {
  let cursor = offset;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
  return cursor;
}

function balancedSpan(source: string, offset: number, open = '{', close = '}'): Span | null {
  let cursor = skipTrivia(source, offset);
  if (source[cursor] !== open) return null;
  const start = cursor;
  let depth = 0;
  let quote: string | null = null;
  while (cursor < source.length) {
    const char = source[cursor];
    if (quote) {
      if (char === '\\') cursor += 2;
      else {
        if (char === quote) quote = null;
        cursor++;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === open) depth++;
    else if (char === close && --depth === 0) return { start, end: cursor + 1 };
    cursor++;
  }
  return null;
}

function objectAfter(source: string, offset: number, variables: Map<string, Span>): Span | null {
  let cursor = skipTrivia(source, offset);
  const direct = balancedSpan(source, cursor);
  if (direct) return direct;
  const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(cursor));
  if (identifier) return variables.get(identifier[0]) ?? null;
  if (source.startsWith('()', cursor) || source.slice(cursor).match(/^(?:async\s*)?\([^)]*\)\s*=>/)) {
    const arrow = source.indexOf('=>', cursor);
    if (arrow !== -1) {
      cursor = skipTrivia(source, arrow + 2);
      if (source[cursor] === '(') cursor = skipTrivia(source, cursor + 1);
      return balancedSpan(source, cursor);
    }
  }
  return null;
}

export function scanObjectMembers(source: string, span: Span, container: string, baseOffset = 0): GyosSymbol[] {
  const result: GyosSymbol[] = [];
  let cursor = span.start + 1;
  while (cursor < span.end - 1) {
    cursor = skipTrivia(source, cursor);
    while (source[cursor] === ',') cursor = skipTrivia(source, cursor + 1);
    if (cursor >= span.end - 1) break;
    const memberStart = cursor;
    const prefix = /^(?:(get|set|async)\s+)?([A-Za-z_$][\w$]*)/.exec(source.slice(cursor));
    if (!prefix) {
      cursor++;
      continue;
    }
    const modifier = prefix[1];
    const name = prefix[2];
    const nameStart = cursor + prefix[0].lastIndexOf(name);
    cursor += prefix[0].length;
    const next = skipTrivia(source, cursor);
    const isMethod = source[next] === '(' || modifier === 'get' || modifier === 'set';
    result.push({
      name,
      kind: isMethod ? 'method' : 'property',
      start: baseOffset + nameStart,
      end: baseOffset + nameStart + name.length,
      container,
      containerStart: baseOffset + span.start,
      containerEnd: baseOffset + span.end,
      detail: modifier === 'get' ? 'getter' : isMethod ? 'method' : 'property'
    });

    let depth = 0;
    let quote: string | null = null;
    cursor = Math.max(cursor, memberStart + 1);
    while (cursor < span.end - 1) {
      const char = source[cursor];
      if (quote) {
        if (char === '\\') cursor += 2;
        else {
          if (char === quote) quote = null;
          cursor++;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === '`') quote = char;
      else if ('({['.includes(char)) depth++;
      else if (')}]'.includes(char)) depth--;
      else if (char === ',' && depth === 0) {
        cursor++;
        break;
      }
      cursor++;
    }
  }
  return result;
}

export function scanJavaScriptSymbols(source: string, baseOffset = 0): GyosSymbol[] {
  const masked = maskComments(source);
  const receivers = new Set(['Gyos']);
  const namedCalls = new Map<string, string>();
  const importPattern = /import\s+([\s\S]*?)\s+from\s+(['"])([^'"\r\n]*gyos[^'"\r\n]*)\2/g;
  for (const match of masked.matchAll(importPattern)) {
    const clause = match[1].trim();
    const defaultImport = /^([A-Za-z_$][\w$]*)/.exec(clause);
    if (defaultImport) receivers.add(defaultImport[1]);
    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (namespace) receivers.add(namespace[1]);
    const named = /\{([^}]*)\}/.exec(clause)?.[1];
    if (named) {
      for (const entry of named.split(',')) {
        const parts = /^\s*(scope|store|provide|pipe|validator|directive|registerTransition)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(entry);
        if (parts) namedCalls.set(parts[2] ?? parts[1], parts[1]);
      }
    }
  }
  const variables = new Map<string, Span>();
  const variablePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
  for (const match of masked.matchAll(variablePattern)) {
    const valueStart = (match.index ?? 0) + match[0].length;
    const span = balancedSpan(masked, valueStart);
    if (span) variables.set(match[1], span);
  }

  const symbols: GyosSymbol[] = [];
  const callPattern = /\b(?:([A-Za-z_$][\w$]*)\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\(\s*(['"])([^'"\r\n]+)\3\s*(?:,|\))/g;
  for (const match of masked.matchAll(callPattern)) {
    if (!isCodeOffset(source, match.index ?? 0)) continue;
    const receiver = match[1];
    const called = match[2];
    const method = receiver ? (receivers.has(receiver) ? called : null) : namedCalls.get(called) ?? null;
    if (!method || !REGISTRATIONS[method]) continue;
    const kind = REGISTRATIONS[method];
    const full = match[0];
    const name = match[4];
    const relativeName = full.indexOf(name);
    const start = (match.index ?? 0) + relativeName;
    symbols.push({ name, kind, start: baseOffset + start, end: baseOffset + start + name.length, role: 'declaration' });
    if ((kind === 'scope' || kind === 'store') && full.trimEnd().endsWith(',')) {
      const argumentOffset = (match.index ?? 0) + full.length;
      const object = objectAfter(masked, argumentOffset, variables);
      if (object) symbols.push(...scanObjectMembers(masked, object, name, baseOffset));
    }
  }
  for (const call of scanGyosCalls(source, baseOffset)) {
    if (!call.argument) continue;
    const isProvide = call.method === 'provide' || call.method === '$provide';
    const isInject = call.method === 'inject' || call.method === '$inject';
    if (isProvide || isInject) {
      symbols.push({
        name: call.argument,
        kind: 'provider',
        start: call.argumentStart!,
        end: call.argumentEnd!,
        role: isProvide ? 'declaration' : 'reference'
      });
    }
    if (['emit', 'on', 'once', 'off', '$emit', '$on'].includes(call.method)) {
      symbols.push({ name: call.argument, kind: 'event', start: call.argumentStart!, end: call.argumentEnd!, role: 'reference' });
    }
  }
  for (const access of scanContextAccesses(source, baseOffset)) {
    if (access.name === '$refs' && access.member) {
      symbols.push({ name: access.member, kind: 'ref', start: access.memberStart!, end: access.memberEnd!, role: 'reference' });
    }
  }
  const unique = new Map<string, GyosSymbol>();
  for (const symbol of symbols) unique.set(`${symbol.kind}:${symbol.name}:${symbol.start}:${symbol.end}:${symbol.role ?? ''}`, symbol);
  return [...unique.values()];
}

function collectGyosImports(source: string): { receivers: Set<string>; named: Map<string, string> } {
  const receivers = new Set(['Gyos']);
  const named = new Map<string, string>();
  const importPattern = /import\s+([\s\S]*?)\s+from\s+(['"])([^'"\r\n]*gyos[^'"\r\n]*)\2/g;
  for (const match of source.matchAll(importPattern)) {
    const clause = match[1].trim();
    const defaultImport = /^([A-Za-z_$][\w$]*)/.exec(clause);
    if (defaultImport) receivers.add(defaultImport[1]);
    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (namespace) receivers.add(namespace[1]);
    const block = /\{([^}]*)\}/.exec(clause)?.[1];
    if (!block) continue;
    for (const entry of block.split(',')) {
      const parts = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(entry);
      if (parts) named.set(parts[2] ?? parts[1], parts[1]);
    }
  }
  return { receivers, named };
}

export function scanGyosCalls(source: string, baseOffset = 0): GyosCall[] {
  const masked = maskComments(source);
  const imports = collectGyosImports(masked);
  const calls: GyosCall[] = [];
  const globalPattern = /\b(?:([A-Za-z_$][\w$]*)\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\(\s*(?:(['"])([^'"\r\n]*)\3)?/g;
  for (const match of masked.matchAll(globalPattern)) {
    if (!isCodeOffset(source, match.index ?? 0)) continue;
    const receiver = match[1];
    const called = match[2];
    const method = receiver ? (imports.receivers.has(receiver) ? called : null) : imports.named.get(called) ?? null;
    if (!method) continue;
    const full = match[0];
    const methodOffset = receiver ? full.indexOf(called, full.indexOf('.') + 1) : full.indexOf(called);
    const argument = match[4];
    const argumentOffset = argument !== undefined ? full.lastIndexOf(argument) : -1;
    calls.push({
      owner: 'gyos', method,
      methodStart: baseOffset + (match.index ?? 0) + methodOffset,
      methodEnd: baseOffset + (match.index ?? 0) + methodOffset + called.length,
      argument,
      argumentStart: argumentOffset >= 0 ? baseOffset + (match.index ?? 0) + argumentOffset : undefined,
      argumentEnd: argumentOffset >= 0 ? baseOffset + (match.index ?? 0) + argumentOffset + argument.length : undefined
    });
  }
  const contextPattern = /(?:\bthis\s*\.\s*)?(\$(?:inject|provide|emit|on|watch|effect))\s*\(\s*(?:(['"])([^'"\r\n]*)\2)?/g;
  for (const match of masked.matchAll(contextPattern)) {
    if (!isCodeOffset(source, match.index ?? 0)) continue;
    const full = match[0];
    const method = match[1];
    const methodOffset = full.indexOf(method);
    const argument = match[3];
    const argumentOffset = argument !== undefined ? full.lastIndexOf(argument) : -1;
    calls.push({
      owner: 'context', method,
      methodStart: baseOffset + (match.index ?? 0) + methodOffset,
      methodEnd: baseOffset + (match.index ?? 0) + methodOffset + method.length,
      argument,
      argumentStart: argumentOffset >= 0 ? baseOffset + (match.index ?? 0) + argumentOffset : undefined,
      argumentEnd: argumentOffset >= 0 ? baseOffset + (match.index ?? 0) + argumentOffset + argument.length : undefined
    });
  }
  return calls;
}

export function scanContextAccesses(source: string, baseOffset = 0): ContextAccess[] {
  const masked = maskComments(source);
  const result: ContextAccess[] = [];
  const pattern = /(?:\bthis\s*\.\s*)?(\$(?:refs|inject|provide|emit|on|watch|effect|index|event))(?:\s*\.\s*([A-Za-z_$][\w$]*))?/g;
  for (const match of masked.matchAll(pattern)) {
    if (!isCodeOffset(source, match.index ?? 0)) continue;
    const full = match[0];
    const name = match[1];
    const member = match[2];
    const nameOffset = full.indexOf(name);
    const memberOffset = member ? full.lastIndexOf(member) : -1;
    result.push({
      name,
      start: baseOffset + (match.index ?? 0) + nameOffset,
      end: baseOffset + (match.index ?? 0) + nameOffset + name.length,
      member,
      memberStart: memberOffset >= 0 ? baseOffset + (match.index ?? 0) + memberOffset : undefined,
      memberEnd: memberOffset >= 0 ? baseOffset + (match.index ?? 0) + memberOffset + member!.length : undefined
    });
  }
  return result;
}

export function identifierAt(source: string, offset: number): { name: string; start: number; end: number } | null {
  let start = offset;
  let end = offset;
  while (start > 0 && /[\w$-]/.test(source[start - 1])) start--;
  while (end < source.length && /[\w$-]/.test(source[end])) end++;
  if (start === end || !/^[A-Za-z_$][\w$-]*$/.test(source.slice(start, end))) return null;
  return { name: source.slice(start, end), start, end };
}
