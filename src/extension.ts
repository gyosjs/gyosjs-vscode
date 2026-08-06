import * as vscode from 'vscode';
import { GyosCompletionProvider } from './language/completion';
import { analyzeTemplate } from './language/diagnostics';
import { GyosHoverProvider } from './language/hover';
import {
  GyosDefinitionProvider,
  GyosReferenceProvider,
  GyosSemanticTokensProvider,
  SEMANTIC_LEGEND
} from './language/intelligence';
import { GYOS_DOCUMENT_SELECTOR, isSupportedDocument } from './language/selectors';
import { WorkspaceIndex } from './language/workspace-index';
import { runMpaAudit } from './language/mpa-audit';

const DOCS_ROOT = 'https://github.com/gyosjs/gyosjs/tree/main/docs/en';

function diagnosticsEnabled(document: vscode.TextDocument): boolean {
  return vscode.workspace.getConfiguration('gyosjs', document.uri).get('diagnostics.enabled', true);
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('gyosjs');
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const index = new WorkspaceIndex();
  const mpaAuditOutput = vscode.window.createOutputChannel('GyosJS MPA Audit');

  const updateDiagnostics = (document: vscode.TextDocument): void => {
    if (!isSupportedDocument(document) || !diagnosticsEnabled(document)) {
      diagnostics.delete(document.uri);
      return;
    }
    index.updateDocument(document);
    const fullDocument = ['html', 'htm'].some(extension => document.fileName.toLowerCase().endsWith(`.${extension}`));
    const issues = analyzeTemplate(document.getText(), { fullDocument });
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
    index,
    mpaAuditOutput,
    vscode.languages.registerCompletionItemProvider(GYOS_DOCUMENT_SELECTOR, new GyosCompletionProvider(index), ' ', '.', ':', '@', '*', '{', '|', '$', '('),
    vscode.languages.registerHoverProvider(GYOS_DOCUMENT_SELECTOR, new GyosHoverProvider(index)),
    vscode.languages.registerDefinitionProvider(GYOS_DOCUMENT_SELECTOR, new GyosDefinitionProvider(index)),
    vscode.languages.registerReferenceProvider(GYOS_DOCUMENT_SELECTOR, new GyosReferenceProvider(index)),
    vscode.languages.registerDocumentSemanticTokensProvider(GYOS_DOCUMENT_SELECTOR, new GyosSemanticTokensProvider(index), SEMANTIC_LEGEND),
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
      if (event.affectsConfiguration('gyosjs.diagnostics.enabled')) {
        for (const document of vscode.workspace.textDocuments) updateDiagnostics(document);
      }
      if (event.affectsConfiguration('gyosjs.indexing')) void index.rebuild();
    }),
    vscode.commands.registerCommand('gyosjs.openDocumentation', () => vscode.env.openExternal(vscode.Uri.parse(DOCS_ROOT))),
    vscode.commands.registerCommand('gyosjs.openApiReference', () => open('api-reference.md')),
    vscode.commands.registerCommand('gyosjs.openMpaGuide', () => open('mpa-boost-deep-dive.md')),
    vscode.commands.registerCommand('gyosjs.rebuildWorkspaceIndex', async () => {
      await index.rebuild();
      for (const document of vscode.workspace.textDocuments) index.updateDocument(document);
      void vscode.window.showInformationMessage('GyosJS workspace index rebuilt.');
    }),
    vscode.commands.registerCommand('gyosjs.auditMpaBoost', () => runMpaAudit(index, mpaAuditOutput)),
    { dispose: () => timers.forEach(timer => clearTimeout(timer)) }
  );

  for (const document of vscode.workspace.textDocuments) updateDiagnostics(document);
  void index.initialize();
}

export function deactivate(): void {}
