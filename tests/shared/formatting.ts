import * as vscode from 'vscode';

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

export async function checkFormattingDiagnostics(): Promise<void> {
  for (const language of ['html', 'php', 'blade-file']) {
    const quoted = "'Your changes were saved\n    and you may continue editing.'";
    const content = `<section g-scope="Page"><p>{ready ? ${quoted} : 'Waiting'}</p></section>`;
    const document = language === 'blade-file'
      ? await vscode.workspace.openTextDocument(vscode.Uri.parse('untitled:/formatting-check.blade.php'))
      : await vscode.workspace.openTextDocument({ language, content });
    if (language === 'blade-file') {
      const insert = new vscode.WorkspaceEdit();
      insert.insert(document.uri, new vscode.Position(0, 0), content);
      if (!await vscode.workspace.applyEdit(insert)) throw new Error('Could not populate Blade fixture');
    }
    await vscode.window.showTextDocument(document);
    const find = () => vscode.languages.getDiagnostics(document.uri).find(item => item.code === 'multiline-interpolation-string');
    await waitFor(() => Boolean(find()), `${language}: missing interpolation warning`);
    const diagnostic = find()!;
    // Inserting into an untitled file adopts the host's default EOL (CRLF on
    // Windows); documents opened with content can keep LF instead.
    const actual = document.getText(diagnostic.range).replace(/\r\n/g, '\n');
    if (actual !== quoted || diagnostic.severity !== vscode.DiagnosticSeverity.Warning) {
      throw new Error(`${language}: incorrect diagnostic range/severity: ${JSON.stringify(actual)}`);
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diagnostic.range, "'Your changes were saved and you may continue editing.'");
    if (!await vscode.workspace.applyEdit(edit)) throw new Error('Could not edit formatting fixture');
    await waitFor(() => !find(), `${language}: stale warning after repairing the string`);
  }
}
