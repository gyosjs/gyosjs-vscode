import * as vscode from 'vscode';
import { documentationUrl, findDefinition } from './contract';
import { attributeAtOffset, scanTemplate } from './scanner';
import { symbolHover } from './intelligence';
import type { WorkspaceIndex } from './workspace-index';

export class GyosHoverProvider implements vscode.HoverProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const offset = document.offsetAt(position);
    const context = attributeAtOffset(scanTemplate(document.getText()), offset);
    const hover = symbolHover(document, position, this.index);
    if (hover) return hover;
    if (!context || context.element.ignored) return null;
    const definition = findDefinition(context.attribute.name);
    if (!definition) return null;

    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(definition.syntax, 'html');
    markdown.appendMarkdown(`${definition.description}\n\n`);
    markdown.appendCodeblock(definition.example, 'html');
    markdown.appendMarkdown(`\n[Read the GyosJS documentation](${documentationUrl(definition)})`);
    const range = new vscode.Range(
      document.positionAt(context.attribute.nameStart),
      document.positionAt(context.attribute.nameEnd)
    );
    return new vscode.Hover(markdown, range);
  }
}
