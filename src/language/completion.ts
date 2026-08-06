import * as vscode from 'vscode';
import {
  ALL_DEFINITIONS,
  BINDING_ATTRIBUTES,
  COMMON_EVENTS,
  EVENT_MODIFIERS,
  KEY_MODIFIERS,
  MODEL_MODIFIERS,
  TRANSITIONS,
  VALIDATORS,
  documentationUrl,
  findDefinition,
  type AttributeDefinition
} from './contract';
import { attributeAtOffset, scanTemplate, type AttributeToken, type ElementToken } from './scanner';
import { contextualCompletions } from './intelligence';
import type { WorkspaceIndex } from './workspace-index';

function markdownFor(definition: AttributeDefinition): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString();
  markdown.appendMarkdown(`${definition.description}\n\n`);
  markdown.appendCodeblock(definition.example, 'html');
  markdown.appendMarkdown(`\n[GyosJS documentation](${documentationUrl(definition)})`);
  return markdown;
}

function attributeCompletion(definition: AttributeDefinition, existing: Set<string>, range: vscode.Range): vscode.CompletionItem | null {
  if (existing.has(definition.name)) return null;
  const item = new vscode.CompletionItem(definition.name, vscode.CompletionItemKind.Property);
  item.detail = `GyosJS ${definition.kind}`;
  item.documentation = markdownFor(definition);
  item.range = range;
  item.insertText = definition.valueRequired
    ? new vscode.SnippetString(`${definition.name}="$1"`)
    : definition.name;
  return item;
}

function dynamicAttributeCompletion(name: string, detail: string, snippet: string, range: vscode.Range): vscode.CompletionItem {
  const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
  item.detail = detail;
  item.insertText = new vscode.SnippetString(snippet);
  item.range = range;
  return item;
}

function valueItems(values: readonly string[]): vscode.CompletionItem[] {
  return values.map(value => {
    const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
    item.insertText = value;
    return item;
  });
}

function modifierItems(values: readonly string[], range: vscode.Range): vscode.CompletionItem[] {
  return values.map(value => {
    const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Keyword);
    item.insertText = value === 'debounce' ? new vscode.SnippetString('debounce.${1:300}') : value;
    item.range = range;
    return item;
  });
}

function attributeValueCompletions(attribute: AttributeToken): vscode.CompletionItem[] {
  const name = attribute.name.toLowerCase();
  const definition = findDefinition(name);
  if (definition?.values) return valueItems(definition.values);
  if (name === 'g-transition' || name.startsWith('g-transition.')) return valueItems(TRANSITIONS);
  if (name === 'g-validate') return valueItems(VALIDATORS);
  return [];
}

function currentNameFragment(document: vscode.TextDocument, element: ElementToken, offset: number): { start: number; value: string } {
  const source = document.getText();
  let cursor = offset;
  while (cursor > element.start && !/[\s<>]/.test(source[cursor - 1])) cursor--;
  return { start: cursor, value: source.slice(cursor, offset) };
}

export class GyosCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const source = document.getText();
    const offset = document.offsetAt(position);
    const scan = scanTemplate(source);
    const context = attributeAtOffset(scan, offset);

    if (context && context.attribute.valueStart !== null && offset >= context.attribute.valueStart) {
      return [...attributeValueCompletions(context.attribute), ...contextualCompletions(document, position, this.index)];
    }

    const expressionItems = contextualCompletions(document, position, this.index);
    if (expressionItems.length) return expressionItems;

    const element = scan.elements.find(candidate => offset > candidate.start && offset <= candidate.openEnd);
    if (!element || element.ignored) return [];
    const current = currentNameFragment(document, element, offset);
    const fragment = current.value.toLowerCase();
    const attributeRange = new vscode.Range(document.positionAt(current.start), position);

    if (fragment.startsWith('g-model.') || fragment.startsWith('g-transition.')) {
      const modifierStart = current.start + fragment.lastIndexOf('.') + 1;
      const range = new vscode.Range(document.positionAt(modifierStart), position);
      return modifierItems(fragment.startsWith('g-model.') ? MODEL_MODIFIERS : ['250', '300', '500', '750', '1000'], range);
    }
    if (fragment.startsWith('@') && fragment.includes('.')) {
      const eventName = fragment.slice(1).split('.')[0];
      const modifiers = eventName.startsWith('key')
        ? [...EVENT_MODIFIERS, ...KEY_MODIFIERS]
        : EVENT_MODIFIERS;
      const modifierStart = current.start + fragment.lastIndexOf('.') + 1;
      return modifierItems(modifiers, new vscode.Range(document.positionAt(modifierStart), position));
    }

    const existing = new Set(element.attributes.map(attribute => attribute.name.toLowerCase()));
    const items = ALL_DEFINITIONS
      .filter(definition => !definition.tags || definition.tags.includes(element.tagName))
      .map(definition => attributeCompletion(definition, existing, attributeRange))
      .filter((item): item is vscode.CompletionItem => item !== null);

    for (const binding of BINDING_ATTRIBUTES) {
      if (!existing.has(`:${binding}`)) items.push(dynamicAttributeCompletion(`:${binding}`, 'GyosJS reactive binding', `:${binding}="$1"`, attributeRange));
    }
    for (const event of COMMON_EVENTS) {
      if (!existing.has(`@${event}`)) items.push(dynamicAttributeCompletion(`@${event}`, 'GyosJS event handler', `@${event}="$1"`, attributeRange));
    }
    for (const directive of this.index.symbols('directive')) {
      const name = `g-${directive.name}`;
      if (!existing.has(name)) items.push(dynamicAttributeCompletion(name, 'GyosJS custom directive', `${name}="$1"`, attributeRange));
    }
    for (const event of new Set(this.index.symbols('event').map(symbol => symbol.name))) {
      const name = `g-on:${event}`;
      if (!existing.has(name)) items.push(dynamicAttributeCompletion(name, 'GyosJS scope event channel', `${name}="$1"`, attributeRange));
    }
    items.push(dynamicAttributeCompletion('gd-property', 'GyosJS auto-scope data', 'gd-${1:name}="$2"', attributeRange));
    items.push(dynamicAttributeCompletion('gm-method', 'GyosJS auto-scope method', 'gm-${1:name}="$2"', attributeRange));
    return items;
  }
}
