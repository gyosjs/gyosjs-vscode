import type * as vscode from 'vscode';

export const GYOS_DOCUMENT_SELECTOR: vscode.DocumentSelector = [
  { language: 'html' },
  { language: 'php' },
  { language: 'blade' },
  { language: 'laravel-blade' },
  { pattern: '**/*.blade.php' }
];

export function isSupportedDocument(document: vscode.TextDocument): boolean {
  return ['html', 'php', 'blade', 'laravel-blade'].includes(document.languageId)
    || document.fileName.toLowerCase().endsWith('.blade.php');
}
