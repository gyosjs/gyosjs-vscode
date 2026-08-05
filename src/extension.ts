import * as vscode from 'vscode';
import { GyosCompletionProvider } from './language/completion';
import { analyzeTemplate } from './language/diagnostics';
import { GyosHoverProvider } from './language/hover';
import { GYOS_DOCUMENT_SELECTOR, isSupportedDocument } from './language/selectors';

const DOCS_ROOT = 'https://github.com/gyosjs/gyosjs/tree/main/docs/en';

function diagnosticsEnabled(document: vscode.TextDocument): boolean {
  return vscode.workspace.getConfiguration('gyosjs', document.uri).get('diagnostics.enabled', true);
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('gyosjs');
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const updateDiagnostics = (document: vscode.TextDocument): void => {
    if (!isSupportedDocument(document) || !diagnosticsEnabled(document)) {
      diagnostics.delete(document.uri);
      return;
    }
    const issues = analyzeTemplate(document.getText());
    const items = issues.map(item => new vscode.Diagnostic(
      new vscode.Range(document.positionAt(item.start), document.positionAt(item.end)),
      item.message,
      item.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    ));
    items.forEach((item, index) => {
      item.source = 'GyosJS';
      item.code = issues[index].code;
    });
    diagnostics.set(document.uri, items);
  };

  const scheduleDiagnostics = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      updateDiagnostics(document);
    }, 150));
  };

  const open = (path: string): Thenable<boolean> => vscode.env.openExternal(vscode.Uri.parse(`${DOCS_ROOT}/${path}`));
  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerCompletionItemProvider(GYOS_DOCUMENT_SELECTOR, new GyosCompletionProvider(), ' ', '.', ':', '@', '*'),
    vscode.languages.registerHoverProvider(GYOS_DOCUMENT_SELECTOR, new GyosHoverProvider()),
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(event => scheduleDiagnostics(event.document)),
    vscode.workspace.onDidSaveTextDocument(updateDiagnostics),
    vscode.workspace.onDidCloseTextDocument(document => {
      const key = document.uri.toString();
      const timer = timers.get(key);
      if (timer) clearTimeout(timer);
      timers.delete(key);
      diagnostics.delete(document.uri);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('gyosjs.diagnostics.enabled')) return;
      for (const document of vscode.workspace.textDocuments) updateDiagnostics(document);
    }),
    vscode.commands.registerCommand('gyosjs.openDocumentation', () => vscode.env.openExternal(vscode.Uri.parse(DOCS_ROOT))),
    vscode.commands.registerCommand('gyosjs.openApiReference', () => open('api-reference.md')),
    vscode.commands.registerCommand('gyosjs.openMpaGuide', () => open('mpa-boost-deep-dive.md')),
    { dispose: () => timers.forEach(timer => clearTimeout(timer)) }
  );

  for (const document of vscode.workspace.textDocuments) updateDiagnostics(document);
}

export function deactivate(): void {}
