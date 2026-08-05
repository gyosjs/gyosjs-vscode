export interface AttributeToken {
  name: string;
  value: string | null;
  nameStart: number;
  nameEnd: number;
  valueStart: number | null;
  valueEnd: number | null;
  quote: '"' | "'" | null;
}

export interface ElementToken {
  tagName: string;
  start: number;
  openEnd: number;
  end: number;
  attributes: AttributeToken[];
  parent: ElementToken | null;
  children: ElementToken[];
  selfClosing: boolean;
  ignored: boolean;
}

export interface TemplateScan {
  elements: ElementToken[];
  roots: ElementToken[];
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);
const P_CLOSING_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
  'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'search', 'section', 'table', 'ul'
]);

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function skipServerBlock(source: string, offset: number): number | null {
  if (source.startsWith('<?', offset)) {
    const end = source.indexOf('?>', offset + 2);
    return end === -1 ? source.length : end + 2;
  }
  if (source.startsWith('{{', offset)) {
    const end = source.indexOf('}}', offset + 2);
    return end === -1 ? source.length : end + 2;
  }
  if (source.startsWith('{!!', offset)) {
    const end = source.indexOf('!!}', offset + 3);
    return end === -1 ? source.length : end + 3;
  }
  return null;
}

function skipBladeDirective(source: string, offset: number): number | null {
  const match = /^@[A-Za-z_][\w:-]*\s*\(/.exec(source.slice(offset));
  if (!match) return null;

  let cursor = offset + match[0].length;
  let depth = 1;
  let quote: '"' | "'" | null = null;
  while (cursor < source.length && depth > 0) {
    const char = source[cursor];
    if (quote) {
      if (char === '\\') cursor++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    }
    cursor++;
  }
  return cursor;
}

function openingTagName(source: string, start: number): string {
  let cursor = start + 1;
  const tagStart = cursor;
  while (cursor < source.length && /[A-Za-z0-9:_-]/.test(source[cursor])) cursor++;
  return source.slice(tagStart, cursor).toLowerCase();
}

function closeThrough(stack: ElementToken[], tags: ReadonlySet<string>, end: number): void {
  for (let index = stack.length - 1; index >= 0; index--) {
    if (!tags.has(stack[index].tagName)) continue;
    for (let removed = index; removed < stack.length; removed++) stack[removed].end = end;
    stack.length = index;
    return;
  }
}

function applyImpliedClosing(stack: ElementToken[], incomingTag: string, end: number): void {
  if (P_CLOSING_ELEMENTS.has(incomingTag)) closeThrough(stack, new Set(['p']), end);
  if (incomingTag === 'li') closeThrough(stack, new Set(['li']), end);
  if (incomingTag === 'dt' || incomingTag === 'dd') closeThrough(stack, new Set(['dt', 'dd']), end);
  if (incomingTag === 'rt' || incomingTag === 'rp') closeThrough(stack, new Set(['rt', 'rp']), end);
  if (incomingTag === 'option') closeThrough(stack, new Set(['option']), end);
  if (incomingTag === 'optgroup') {
    closeThrough(stack, new Set(['option']), end);
    closeThrough(stack, new Set(['optgroup']), end);
  }
  if (incomingTag === 'tr') closeThrough(stack, new Set(['tr']), end);
  if (incomingTag === 'td' || incomingTag === 'th') closeThrough(stack, new Set(['td', 'th']), end);
  if (incomingTag === 'thead' || incomingTag === 'tbody' || incomingTag === 'tfoot') {
    closeThrough(stack, new Set(['thead', 'tbody', 'tfoot']), end);
  }
}

function parseOpeningTag(source: string, start: number, parent: ElementToken | null): { element: ElementToken; next: number } | null {
  let cursor = start + 1;
  const tagStart = cursor;
  while (cursor < source.length && /[A-Za-z0-9:_-]/.test(source[cursor])) cursor++;
  if (cursor === tagStart) return null;

  const tagName = source.slice(tagStart, cursor).toLowerCase();
  const attributes: AttributeToken[] = [];
  let selfClosing = false;

  while (cursor < source.length) {
    while (cursor < source.length && isWhitespace(source[cursor])) cursor++;
    const serverEnd = skipServerBlock(source, cursor);
    if (serverEnd !== null) {
      cursor = serverEnd;
      continue;
    }
    const bladeEnd = skipBladeDirective(source, cursor);
    if (bladeEnd !== null) {
      cursor = bladeEnd;
      continue;
    }
    if (source.startsWith('/>', cursor)) {
      selfClosing = true;
      cursor += 2;
      break;
    }
    if (source[cursor] === '>') {
      cursor++;
      break;
    }
    if (cursor >= source.length) break;

    const nameStart = cursor;
    while (cursor < source.length && !isWhitespace(source[cursor]) && !['=', '>', '/'].includes(source[cursor])) cursor++;
    if (cursor === nameStart) {
      cursor++;
      continue;
    }
    const nameEnd = cursor;
    const name = source.slice(nameStart, nameEnd);
    while (cursor < source.length && isWhitespace(source[cursor])) cursor++;

    let value: string | null = null;
    let valueStart: number | null = null;
    let valueEnd: number | null = null;
    let quote: '"' | "'" | null = null;
    if (source[cursor] === '=') {
      cursor++;
      while (cursor < source.length && isWhitespace(source[cursor])) cursor++;
      if (source[cursor] === '"' || source[cursor] === "'") {
        quote = source[cursor] as '"' | "'";
        cursor++;
        valueStart = cursor;
        while (cursor < source.length && source[cursor] !== quote) cursor++;
        valueEnd = cursor;
        value = source.slice(valueStart, valueEnd);
        if (source[cursor] === quote) cursor++;
      } else {
        valueStart = cursor;
        while (cursor < source.length && !isWhitespace(source[cursor]) && source[cursor] !== '>') cursor++;
        valueEnd = cursor;
        value = source.slice(valueStart, valueEnd);
      }
    }

    attributes.push({ name, value, nameStart, nameEnd, valueStart, valueEnd, quote });
  }

  selfClosing ||= VOID_ELEMENTS.has(tagName);
  const ignored = Boolean(parent?.ignored || attributes.some(attribute => attribute.name.toLowerCase() === 'g-ignore'));
  const element: ElementToken = {
    tagName,
    start,
    openEnd: cursor,
    end: cursor,
    attributes,
    parent,
    children: [],
    selfClosing,
    ignored
  };
  if (parent) parent.children.push(element);
  return { element, next: cursor };
}

export function scanTemplate(source: string): TemplateScan {
  const roots: ElementToken[] = [];
  const elements: ElementToken[] = [];
  const stack: ElementToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (source.startsWith('<!--', cursor)) {
      const end = source.indexOf('-->', cursor + 4);
      cursor = end === -1 ? source.length : end + 3;
      continue;
    }
    const serverEnd = skipServerBlock(source, cursor);
    if (serverEnd !== null) {
      cursor = serverEnd;
      continue;
    }
    if (source[cursor] !== '<') {
      cursor++;
      continue;
    }
    if (source.startsWith('</', cursor)) {
      let nameCursor = cursor + 2;
      const nameStart = nameCursor;
      while (nameCursor < source.length && /[A-Za-z0-9:_-]/.test(source[nameCursor])) nameCursor++;
      const tagName = source.slice(nameStart, nameCursor).toLowerCase();
      const closeEnd = source.indexOf('>', nameCursor);
      const next = closeEnd === -1 ? source.length : closeEnd + 1;
      for (let index = stack.length - 1; index >= 0; index--) {
        const element = stack[index];
        if (element.tagName === tagName) {
          for (let removed = index; removed < stack.length; removed++) stack[removed].end = next;
          stack.length = index;
          break;
        }
      }
      cursor = next;
      continue;
    }
    if (source.startsWith('<!', cursor) || source.startsWith('<?', cursor)) {
      const end = source.indexOf('>', cursor + 2);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }

    const tagName = openingTagName(source, cursor);
    applyImpliedClosing(stack, tagName, cursor);
    const parsed = parseOpeningTag(source, cursor, stack.at(-1) ?? null);
    if (!parsed) {
      cursor++;
      continue;
    }
    const { element, next } = parsed;
    elements.push(element);
    if (!element.parent) roots.push(element);
    cursor = next;

    if (!element.selfClosing) {
      stack.push(element);
      if (RAW_TEXT_ELEMENTS.has(element.tagName)) {
        const closePattern = `</${element.tagName}`;
        const closeStart = source.toLowerCase().indexOf(closePattern, cursor);
        if (closeStart === -1) {
          element.end = source.length;
          stack.pop();
          cursor = source.length;
        } else {
          cursor = closeStart;
        }
      }
    }
  }

  for (const element of stack) element.end = source.length;
  return { elements, roots };
}

export function attributeAtOffset(scan: TemplateScan, offset: number): { element: ElementToken; attribute: AttributeToken } | null {
  for (const element of scan.elements) {
    if (offset < element.start || offset > element.openEnd) continue;
    for (const attribute of element.attributes) {
      const end = attribute.valueEnd ?? attribute.nameEnd;
      if (offset >= attribute.nameStart && offset <= end + 1) return { element, attribute };
    }
  }
  return null;
}

export function elementAtOffset(scan: TemplateScan, offset: number): ElementToken | null {
  let result: ElementToken | null = null;
  for (const element of scan.elements) {
    if (offset >= element.start && offset <= element.end && (!result || element.start >= result.start)) result = element;
  }
  return result;
}

export function getAttribute(element: ElementToken, name: string): AttributeToken | undefined {
  const lower = name.toLowerCase();
  return element.attributes.find(attribute => attribute.name.toLowerCase() === lower);
}
