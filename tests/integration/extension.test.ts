import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('gyosjs.gyosjs');
  assert.ok(extension);
  await extension.activate();

  const document = await vscode.workspace.openTextDocument({
    language: 'html',
    content: '<div g-scope="Page"><input g-model.lazy="name"></div>'
  });
  await vscode.window.showTextDocument(document);

  const completionDocument = await vscode.workspace.openTextDocument({ language: 'html', content: '<div ></div>' });
  const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    completionDocument.uri,
    new vscode.Position(0, 5),
    ' '
  );
  assert.ok(completions.items.some(item => item.label === 'g-scope'));

  const prefixedDocument = await vscode.workspace.openTextDocument({ language: 'html', content: '<div *i></div>' });
  const prefixed = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    prefixedDocument.uri,
    new vscode.Position(0, 7)
  );
  const ifCompletion = prefixed.items.find(item => item.label === '*if');
  assert.ok(ifCompletion);
  assert.deepEqual(ifCompletion.range, new vscode.Range(0, 5, 0, 7));

  const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    document.uri,
    new vscode.Position(0, 6)
  );
  assert.ok(hover.length > 0);

  await new Promise(resolve => setTimeout(resolve, 250));
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  assert.ok(diagnostics.some(item => item.code === 'invalid-model-modifier'));
}
