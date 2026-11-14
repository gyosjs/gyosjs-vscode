import { getAttribute, type ElementToken, type TemplateScan } from './scanner';
import type { TemplateIssue } from './diagnostics';

const rawText = new Set(['script', 'style', 'noscript', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);

function ownsReactiveText(element: ElementToken): boolean {
  let owner = false;
  for (let current: ElementToken | null = element; current; current = current.parent) {
    if (current.ignored || rawText.has(current.tagName) || getAttribute(current, 'g-text') || getAttribute(current, 'g-html')) return false;
    owner ||= current.attributes.some(attribute => attribute.name === 'g-scope'
      || attribute.name.startsWith('gd-') || attribute.name.startsWith('gm-'));
  }
  return owner;
}

// Deliberately narrow, not a JavaScript/CSP parser. Skip ambiguous token classes
// rather than treating regexes, comments, template literals or entities as strings.
function brokenStrings(expression: string): Array<{ start: number; end: number }> {
  if (expression.includes('{') || /&(?:#\w+|[a-z]+);/i.test(expression)) return [];
  const ranges: Array<{ start: number; end: number }> = [];
  let quote = '', start = 0, newline = false;
  for (let index = 0; index < expression.length; index++) {
    const char = expression[index];
    if (quote) {
      if (char === '\\') {
        index++;
        if (expression[index] === '\r' && expression[index + 1] === '\n') index++;
      } else if (char === quote) {
        if (newline) ranges.push({ start, end: index + 1 });
        quote = '';
      } else if (char === '\r' || char === '\n') {
        newline = true;
      }
    } else if (char === '`' || char === '/') {
      return [];
    } else if (char === '"' || char === "'") {
      quote = char;
      start = index;
      newline = false;
    }
  }
  return quote ? [] : ranges; // Incomplete edits should not produce this warning.
}

export function interpolationIssues(source: string, scan: TemplateScan): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  for (const text of scan.text) {
    if (!ownsReactiveText(text.parent)) continue;
    const content = source.slice(text.start, text.end);
    // Match from the first opening brace like the runtime; do not restart at
    // an inner brace in a comment, regex or template literal.
    for (const match of content.matchAll(/\{([^}]+)\}/g)) {
      const offset = text.start + match.index! + 1;
      for (const range of brokenStrings(match[1])) {
        issues.push({
          start: offset + range.start,
          end: offset + range.end,
          code: 'multiline-interpolation-string',
          severity: 'warning',
          message: 'A raw line break inside a quoted interpolation string is invalid JavaScript. Check your HTML formatter; move long text into a scope field/getter or use g-text.'
        });
      }
    }
  }
  return issues;
}
