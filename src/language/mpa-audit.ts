import * as vscode from 'vscode';
import { getAttribute, type ElementToken } from './scanner';
import { resolveStaticHtmlUri } from './intelligence';
import type { IndexedFile, WorkspaceIndex } from './workspace-index';

const ROUTER_ATTRIBUTES = new Set([
  'g-boost', 'g-no-boost', 'g-outlet', 'g-target', 'g-swap', 'g-preload', 'g-snapshot',
  'g-persist', 'g-current-head', 'g-change-state', 'g-current-state', 'g-noscroll',
  'g-router-spin', 'g-router-link', 'g-router-method', 'g-router-params', 'g-script-once', 'g-script-wrap'
]);

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < source.length; index++) if (source[index] === '\n') line++;
  return line;
}

function hasAncestorAttribute(element: ElementToken, name: string): boolean {
  let current: ElementToken | null = element;
  while (current) {
    if (getAttribute(current, name)) return true;
    current = current.parent;
  }
  return false;
}

function routerElements(file: IndexedFile): ElementToken[] {
  return (file.scan?.elements ?? []).filter(element => element.attributes.some(attribute => ROUTER_ATTRIBUTES.has(attribute.name.toLowerCase())));
}

function report(output: vscode.OutputChannel, file: IndexedFile, element: ElementToken, message: string): void {
  output.appendLine(`${vscode.workspace.asRelativePath(file.uri)}:${lineAt(file.source, element.start)}  ${message}`);
}

export async function runMpaAudit(index: WorkspaceIndex, output: vscode.OutputChannel): Promise<void> {
  await index.initialize();
  output.clear();
  output.appendLine('GyosJS MPA Boost audit');
  output.appendLine('====================');
  let findings = 0;
  const validateStaticRoutes = vscode.workspace.getConfiguration('gyosjs').get('mpa.staticRouteValidation', true);

  for (const file of index.allFiles()) {
    if (!file.scan) continue;
    const related = routerElements(file);
    if (!related.length) continue;
    const hasBoost = file.scan.elements.some(element => Boolean(getAttribute(element, 'g-boost')));
    const outlets = file.scan.elements.filter(element => Boolean(getAttribute(element, 'g-outlet')));
    if (!hasBoost) {
      report(output, file, related[0], 'Router attributes are present, but this document has no visible g-boost. Confirm that a server layout provides it.');
      findings++;
    }
    if (outlets.length > 1) {
      report(output, file, outlets[1], 'Multiple outlets make global fallback positional; use stable target IDs for partial navigation.');
      findings++;
    }

    for (const element of file.scan.elements) {
      const routerLink = getAttribute(element, 'g-router-link');
      const href = getAttribute(element, 'href');
      const route = routerLink?.value ?? (hasAncestorAttribute(element, 'g-boost') ? href?.value : null);
      if (!route) continue;
      const target = getAttribute(element, 'g-target')?.value?.trim();
      if (!target && !hasAncestorAttribute(element, 'g-outlet') && outlets.length === 0) {
        report(output, file, element, 'Navigation trigger has no explicit target, outlet ancestor, or document outlet.');
        findings++;
      }
      const destinationUri = resolveStaticHtmlUri(file.uri, route.trim());
      if (!validateStaticRoutes || !destinationUri) continue;
      const destination = index.file(destinationUri);
      if (!destination) {
        report(output, file, element, `Static HTML route does not exist in the workspace: ${route}`);
        findings++;
        continue;
      }
      const destinationOutlets = destination.scan
        ? destination.scan.elements.filter(candidate => Boolean(getAttribute(candidate, 'g-outlet')))
        : [];
      if (target?.startsWith('#')) {
        const id = target.slice(1);
        const matchingTarget = destination.symbols.some(symbol => symbol.kind === 'id' && symbol.name === id);
        if (!matchingTarget && destinationOutlets.length === 0) {
          report(output, file, element, `Response ${route} has neither ${target} nor a g-outlet; the response body will be inserted into the partial target.`);
          findings++;
        }
      } else if (destinationOutlets.length === 0) {
        report(output, file, element, `Response ${route} has no g-outlet for full-outlet matching.`);
        findings++;
      }
      const sourceKeys = file.symbols.filter(symbol => symbol.kind === 'persist').map(symbol => symbol.name);
      const destinationKeys = new Set(destination.symbols.filter(symbol => symbol.kind === 'persist').map(symbol => symbol.name));
      for (const key of sourceKeys) {
        if (!destinationKeys.has(key)) {
          report(output, file, element, `Persist island "${key}" has no counterpart in ${route}.`);
          findings++;
        }
      }
    }

    for (const script of file.scan.elements.filter(element => element.tagName === 'script' && hasAncestorAttribute(element, 'g-outlet'))) {
      if (!getAttribute(script, 'src') && !getAttribute(script, 'g-script-once') && !getAttribute(script, 'g-script-wrap')) {
        report(output, file, script, 'Inline script inside an outlet reruns after navigation; confirm that its side effects are idempotent.');
        findings++;
      }
    }
  }

  output.appendLine('');
  output.appendLine(findings ? `${findings} audit finding(s).` : 'No MPA Boost audit findings.');
  output.show(true);
}
