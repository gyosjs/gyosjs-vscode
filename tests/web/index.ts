import * as vscode from 'vscode';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('gyosjs.gyosjs');
  assert(extension, 'GyosJS extension is not installed in the web host');
  await extension.activate();

  const document = await vscode.workspace.openTextDocument({ language: 'html', content: '<main ></main>' });
  const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    document.uri,
    new vscode.Position(0, 6),
    ' '
  );
  assert(completions.items.some(item => item.label === 'g-outlet'), 'Web completion provider did not activate');
}
