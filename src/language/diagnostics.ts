import { ALL_DEFINITIONS, MODEL_MODIFIERS } from './contract';
import { getAttribute, scanTemplate, type AttributeToken, type ElementToken } from './scanner';

export type IssueSeverity = 'error' | 'warning';

export interface TemplateIssue {
  start: number;
  end: number;
  message: string;
  code: string;
  severity: IssueSeverity;
}

export interface AnalyzeTemplateOptions {
  fullDocument?: boolean;
}

const structuralNames = new Set(ALL_DEFINITIONS.filter(item => item.kind === 'structural').map(item => item.name));
const reactiveDirectiveNames = new Set(ALL_DEFINITIONS.filter(item => item.kind === 'directive').map(item => item.name));
const activeUrlElements = new Set(['base', 'embed', 'iframe', 'link', 'object', 'script']);
const urlAttributes = new Set(['action', 'background', 'cite', 'formaction', 'href', 'poster', 'src', 'xlink:href']);
const unsafePathParts = new Set(['__proto__', 'prototype', 'constructor']);

function rangeFor(attribute: AttributeToken): Pick<TemplateIssue, 'start' | 'end'> {
  return { start: attribute.nameStart, end: attribute.valueEnd ?? attribute.nameEnd };
}

function issue(attribute: AttributeToken, message: string, code: string, severity: IssueSeverity = 'error'): TemplateIssue {
  return { ...rangeFor(attribute), message, code, severity };
}

function hasUnsafePath(path: string): boolean {
  return path.split(/[.[\]]+/).filter(Boolean).some(part => unsafePathParts.has(part));
}

function isServerRenderedValue(value: string): boolean {
  return /(?:\{\{|\{!!|<\?(?:=|php)?|@(?:json|js)\s*\()/i.test(value);
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, body: string) => {
    if (body[0] !== '#') return named[body.toLowerCase()] ?? entity;
    const radix = body[1]?.toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? body.slice(2) : body.slice(1);
    const codePoint = Number.parseInt(digits, radix);
    return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

function hasReactiveContext(element: ElementToken): boolean {
  let current: ElementToken | null = element;
  while (current) {
    if (current.attributes.some(attribute => {
      const name = attribute.name.toLowerCase();
      return structuralNames.has(name)
        || reactiveDirectiveNames.has(name)
        || name.startsWith('g-model.')
        || name.startsWith('g-transition.')
        || name.startsWith('g-on:')
        || name.startsWith('gd-')
        || name.startsWith('gm-');
    })) return true;
    current = current.parent;
  }
  return false;
}

function previousElementSibling(element: ElementToken, roots: readonly ElementToken[]): ElementToken | null {
  const siblings = element.parent?.children ?? roots;
  const index = siblings.indexOf(element);
  return index > 0 ? siblings[index - 1] : null;
}

function hasStructural(element: ElementToken, names?: readonly string[]): boolean {
  return element.attributes.some(attribute => {
    const name = attribute.name.toLowerCase();
    return names ? names.includes(name) : structuralNames.has(name);
  });
}

function hasStructuralContext(element: ElementToken): boolean {
  let current: ElementToken | null = element;
  while (current) {
    if (hasStructural(current)) return true;
    current = current.parent;
  }
  return false;
}

function validateStructure(element: ElementToken, roots: readonly ElementToken[], issues: TemplateIssue[]): void {
  const structural = element.attributes.filter(attribute => attribute.name.startsWith('*'));
  const known = structural.filter(attribute => structuralNames.has(attribute.name.toLowerCase()));
  for (const attribute of structural) {
    if (!structuralNames.has(attribute.name.toLowerCase()) && hasReactiveContext(element)) {
      issues.push(issue(attribute, `Unknown GyosJS structural directive "${attribute.name}".`, 'unknown-structural'));
    }
  }
  if (known.length > 1) {
    for (const attribute of known.slice(1)) {
      issues.push(issue(attribute, 'An element can only own one structural directive.', 'duplicate-structural'));
    }
  }

  const forAttribute = getAttribute(element, '*for');
  if (forAttribute && (forAttribute.value === null || !/^\s*[A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)?\s+in\s+.+$/.test(forAttribute.value))) {
    issues.push(issue(forAttribute, 'Use "item in items" or "item, index in items" syntax.', 'invalid-for-expression'));
  }

  const chainAttribute = getAttribute(element, '*elseif') ?? getAttribute(element, '*else');
  if (chainAttribute) {
    const previous = previousElementSibling(element, roots);
    if (!previous || !hasStructural(previous, ['*if', '*elseif'])) {
      issues.push(issue(chainAttribute, `${chainAttribute.name} must immediately follow an *if or *elseif sibling.`, 'orphan-if-branch'));
    }
  }

  for (const name of ['*case', '*default']) {
    const attribute = getAttribute(element, name);
    if (attribute && (!element.parent || !getAttribute(element.parent, '*switch'))) {
      issues.push(issue(attribute, `${name} must be a direct child of *switch.`, 'orphan-switch-branch'));
    }
  }
  for (const name of ['*pending', '*then', '*catch']) {
    const attribute = getAttribute(element, name);
    if (attribute && (!element.parent || !getAttribute(element.parent, '*await'))) {
      issues.push(issue(attribute, `${name} must be a direct child of *await.`, 'orphan-await-branch'));
    }
  }
}

function validateAttribute(element: ElementToken, attribute: AttributeToken, issues: TemplateIssue[]): void {
  const name = attribute.name.toLowerCase();
  const definition = ALL_DEFINITIONS.find(candidate => candidate.name === name)
    ?? (name.startsWith('g-model.') ? ALL_DEFINITIONS.find(candidate => candidate.name === 'g-model') : undefined)
    ?? (name.startsWith('g-transition.') ? ALL_DEFINITIONS.find(candidate => candidate.name === 'g-transition') : undefined);

  if (definition?.valueRequired && (!attribute.value || !attribute.value.trim())) {
    issues.push(issue(attribute, `${definition.name} requires a non-empty value.`, 'missing-value'));
  }
  if (definition?.tags && !definition.tags.includes(element.tagName)) {
    issues.push(issue(attribute, `${definition.name} is only supported on ${definition.tags.join(', ')} elements.`, 'invalid-element'));
  }
  if (definition?.values && attribute.value && !isServerRenderedValue(attribute.value)) {
    const value = attribute.value.trim();
    const validHydration = definition.name === 'g-hydrate' && /^media\(.+\)$/.test(value);
    if (!validHydration && !definition.values.some(candidate => candidate.toLowerCase() === value.toLowerCase())) {
      issues.push(issue(attribute, `Unsupported ${definition.name} value "${value}".`, 'invalid-enum-value'));
    }
  }

  if (name.startsWith('g-model.')) {
    const modifiers = name.split('.').slice(1);
    for (let index = 0; index < modifiers.length; index++) {
      const modifier = modifiers[index];
      const numericDelay = /^\d+$/.test(modifier) && index > 0 && modifiers[index - 1] === 'debounce';
      if (!MODEL_MODIFIERS.includes(modifier as typeof MODEL_MODIFIERS[number]) && !numericDelay) {
        issues.push(issue(attribute, `Unsupported g-model modifier "${modifier}".`, 'invalid-model-modifier'));
      }
    }
    const debounceIndex = modifiers.indexOf('debounce');
    if (debounceIndex !== -1 && modifiers[debounceIndex + 1] !== undefined && !/^\d+$/.test(modifiers[debounceIndex + 1])) {
      issues.push(issue(attribute, 'g-model.debounce delay must be a whole number of milliseconds.', 'invalid-debounce'));
    }
  }
  if (name.startsWith('g-transition.')) {
    const duration = name.slice('g-transition.'.length);
    if (!/^\d+$/.test(duration) || Number(duration) <= 0) {
      issues.push(issue(attribute, 'g-transition duration must be a positive whole number.', 'invalid-transition-duration'));
    }
  }
  if (name === 'g-model' || name.startsWith('g-model.')) {
    if (attribute.value && hasUnsafePath(attribute.value)) {
      issues.push(issue(attribute, 'This model path contains an unsafe property key.', 'unsafe-model-path'));
    }
  }
  if (name === 'g-transition' || name.startsWith('g-transition.')) {
    if (!hasStructuralContext(element) && !getAttribute(element, 'g-show')) {
      issues.push(issue(attribute, 'g-transition requires a structural branch or g-show.', 'transition-without-target', 'warning'));
    }
  }
  if (name === 'g-portal' && !getAttribute(element, '*if')) {
    issues.push(issue(attribute, 'g-portal requires *if on the same element.', 'portal-without-if'));
  }
  if (name === 'g-hydrate' && !getAttribute(element, 'g-scope')) {
    issues.push(issue(attribute, 'g-hydrate requires g-scope on the same element.', 'hydrate-without-scope'));
  }
  if (name === 'g-submit' && !getAttribute(element, 'g-form')) {
    issues.push(issue(attribute, 'g-submit requires g-form on the same form.', 'submit-without-form'));
  }
  if (name === 'g-key' && !getAttribute(element, '*for')) {
    issues.push(issue(attribute, 'g-key only affects an element rendered by *for.', 'key-without-for', 'warning'));
  }
  if (name === 'g-provide' && attribute.value && !isServerRenderedValue(attribute.value)) {
    try {
      const parsed: unknown = JSON.parse(decodeHtmlEntities(attribute.value));
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not-object');
    } catch {
      issues.push(issue(attribute, 'g-provide must contain a valid JSON object.', 'invalid-provide-json'));
    }
  }
  if (name.startsWith('@')) {
    const modifiers = name.split('.').slice(1);
    if (modifiers.includes('passive') && modifiers.includes('prevent')) {
      issues.push(issue(attribute, '.prevent has no effect on a passive event listener.', 'passive-prevent', 'warning'));
    }
    const debounceIndex = modifiers.indexOf('debounce');
    if (debounceIndex !== -1 && modifiers[debounceIndex + 1] !== undefined && !/^\d+$/.test(modifiers[debounceIndex + 1])) {
      issues.push(issue(attribute, 'Event debounce delay must be a whole number of milliseconds.', 'invalid-event-debounce'));
    }
  }
  if (name.startsWith(':')) {
    if (element.tagName.startsWith('x-') || !hasReactiveContext(element)) return;
    const boundName = name.slice(1);
    const frameworkOwned = boundName.startsWith('g-') || boundName.startsWith('gd-') || boundName.startsWith('gm-');
    const executable = boundName.startsWith('on') || boundName === 'srcdoc' || boundName === 'xmlns';
    if (!boundName || frameworkOwned || executable || /^[\s@:*]/.test(boundName)) {
      issues.push(issue(attribute, `GyosJS blocks the unsafe or framework-owned "${boundName}" binding.`, 'blocked-binding'));
    } else if ((urlAttributes.has(boundName) && activeUrlElements.has(element.tagName))
      || (boundName === 'data' && element.tagName === 'object')) {
      issues.push(issue(attribute, `Reactive ${boundName} is blocked on active-content <${element.tagName}> elements.`, 'active-url-binding'));
    }
  }
}

function isLiteralValue(value: string): boolean {
  return !isServerRenderedValue(value) && !/[{}$]/.test(value);
}

function isPlausibleSelector(value: string): boolean {
  let square = 0;
  let round = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[') square++;
    else if (char === ']' && --square < 0) return false;
    else if (char === '(') round++;
    else if (char === ')' && --round < 0) return false;
  }
  return Boolean(value.trim()) && !quote && square === 0 && round === 0 && !/[#.:>+~,]\s*$/.test(value);
}

function validateRouterElement(element: ElementToken, issues: TemplateIssue[]): void {
  const routerLink = getAttribute(element, 'g-router-link');
  const method = getAttribute(element, 'g-router-method');
  const params = getAttribute(element, 'g-router-params');
  const changeState = getAttribute(element, 'g-change-state');
  const currentState = getAttribute(element, 'g-current-state');
  const target = getAttribute(element, 'g-target');
  const currentHead = getAttribute(element, 'g-current-head');
  const preload = getAttribute(element, 'g-preload');

  if (method && !routerLink) issues.push(issue(method, 'g-router-method requires g-router-link on the same element.', 'router-method-without-link'));
  if (params && !routerLink) issues.push(issue(params, 'g-router-params requires g-router-link on the same element.', 'router-params-without-link'));
  if (changeState && currentState) issues.push(issue(currentState, 'g-current-state conflicts with g-change-state.', 'conflicting-router-state'));
  if (preload && element.tagName !== 'a') issues.push(issue(preload, 'g-preload is only supported on anchors.', 'invalid-preload-element'));
  if (currentHead && target) issues.push(issue(currentHead, 'g-current-head has no effect on a partial g-target navigation.', 'current-head-with-target', 'warning'));
  if (target?.value && isLiteralValue(target.value) && !isPlausibleSelector(target.value.trim())) {
    issues.push(issue(target, 'g-target must contain a valid CSS selector.', 'invalid-router-target'));
  }
  for (const attribute of element.attributes) {
    const name = attribute.name.toLowerCase();
    if ((name === 'g-script-once' || name === 'g-script-wrap') && element.tagName !== 'script') {
      issues.push(issue(attribute, `${name} is only supported on script elements.`, 'invalid-script-lifecycle-element'));
    }
  }
}

export function analyzeTemplate(source: string, options: AnalyzeTemplateOptions = {}): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const scan = scanTemplate(source);
  for (const element of scan.elements) {
    if (element.ignored) continue;
    validateStructure(element, scan.roots, issues);
    for (const attribute of element.attributes) validateAttribute(element, attribute, issues);
    validateRouterElement(element, issues);
  }

  const persist = new Map<string, AttributeToken>();
  const ids = new Set<string>();
  for (const element of scan.elements) {
    if (element.ignored) continue;
    const id = getAttribute(element, 'id')?.value?.trim();
    if (id) ids.add(id);
    const attribute = getAttribute(element, 'g-persist');
    const key = attribute?.value?.trim();
    if (attribute && key && isLiteralValue(key)) {
      const previous = persist.get(key);
      if (previous) issues.push(issue(attribute, `Duplicate g-persist key "${key}" in the same document.`, 'duplicate-persist-key'));
      else persist.set(key, attribute);
    }
  }
  if (options.fullDocument !== false) {
    for (const element of scan.elements) {
      if (element.ignored) continue;
      const target = getAttribute(element, 'g-target');
      const value = target?.value?.trim();
      if (target && value && /^#[A-Za-z_][\w:.-]*$/.test(value) && !ids.has(value.slice(1))) {
        issues.push(issue(target, `No element with id "${value.slice(1)}" exists in this document.`, 'missing-router-target'));
      }
    }
  }
  return issues.sort((left, right) => left.start - right.start || left.code.localeCompare(right.code));
}
