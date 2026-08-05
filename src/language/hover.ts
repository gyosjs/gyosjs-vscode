import * as vscode from 'vscode';
import { documentationUrl, findDefinition } from './contract';
import { attributeAtOffset, scanTemplate } from './scanner';

export class GyosHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const offset = document.offsetAt(position);
    const context = attributeAtOffset(scanTemplate(document.getText()), offset);
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
