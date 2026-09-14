import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { indexSource } from '../../src/language/workspace-index';
import { WorkspaceIndex } from '../../src/language/workspace-index';
import { GyosDefinitionProvider, GyosSemanticTokensProvider } from '../../src/language/intelligence';
import { elementAtOffset, getAttribute } from '../../src/language/scanner';

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
  assert.ok(completions.items.some(item => item.label === 'g-router-remove'));

  for (const [tag, attribute] of [['form', 'g-boost-errors'], ['script', 'g-head-persist']]) {
    const routerDocument = await vscode.workspace.openTextDocument({ language: 'html', content: `<${tag} ></${tag}>` });
    const items = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider', routerDocument.uri, new vscode.Position(0, tag.length + 2), ' '
    );
    assert.ok(items.items.some(item => item.label === attribute), `Missing ${attribute} completion`);
    const example = await vscode.workspace.openTextDocument({ language: 'html', content: `<${tag} ${attribute}="422"></${tag}>` });
    const docs = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', example.uri, new vscode.Position(0, tag.length + 4)
    );
    assert.ok(docs.length > 0, `Missing ${attribute} hover`);
  }

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

  const smartDocument = await vscode.workspace.openTextDocument({
    language: 'html',
    content: `<div g-scope="Page"><span>{count}</span><button @click="increment()">Add</button></div>
      <script>Gyos.scope('Page', { count: 0, increment() { this.count++ } })</script>`
  });
  await vscode.window.showTextDocument(smartDocument);
  await new Promise(resolve => setTimeout(resolve, 250));
  const indexedSmartDocument = indexSource(smartDocument.uri, smartDocument.getText());
  assert.ok(
    indexedSmartDocument.symbols.some(symbol => symbol.container === 'Page' && symbol.name === 'count'),
    JSON.stringify(indexedSmartDocument.symbols)
  );
  const countOffset = smartDocument.getText().indexOf('{count}') + 2;
  const countPosition = smartDocument.positionAt(countOffset);
  const countElement = indexedSmartDocument.scan ? elementAtOffset(indexedSmartDocument.scan, countOffset) : null;
  assert.ok(countElement, 'No template element owns the interpolation');
  assert.equal(getAttribute(countElement.parent ?? countElement, 'g-scope')?.value, 'Page');
  const directIndex = new WorkspaceIndex();
  const firstIndex = directIndex.updateDocument(smartDocument);
  const cachedIndex = directIndex.updateDocument(smartDocument);
  assert.strictEqual(cachedIndex, firstIndex, 'Unchanged documents should reuse their parsed index');
  const directDefinitions = new GyosDefinitionProvider(directIndex).provideDefinition(smartDocument, countPosition);
  assert.ok(directDefinitions && (!Array.isArray(directDefinitions) || directDefinitions.length > 0));
  directIndex.dispose();
  const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeDefinitionProvider', smartDocument.uri, countPosition
  );
  assert.ok(definitions.some(location => location.uri.toString() === smartDocument.uri.toString()));
  const smartCompletions = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider', smartDocument.uri, countPosition
  );
  assert.ok(smartCompletions.items.some(item => item.label === 'increment'));

  const examplesDocument = await vscode.workspace.openTextDocument({
    language: 'html',
    content: `<section g-scope="Demo" g-provide='{"theme":"dark"}' g-on:user-login="handleLogin">
      <p g-ref="description">{items.length}</p>
      <ul><li *for="item in items" g-key="item.id">{$index}: {item.label}</li></ul>
      <div *if="open" g-transition="fade">{$inject('theme')}</div>
    </section>
    <div g-scope="{ title: Gyos.inject('globalTheme'), inspect() { return this.$refs.inlineRef } }">
      <span g-ref="inlineRef">{title}</span>
    </div>
    <script type="module">
      Gyos.provide('globalTheme', 'dark');
      Gyos.scope('Demo', {
        items: [], open: true, handleLogin(user) {},
        onMount() {
          this.$refs.description.textContent = this.$inject('theme');
          Gyos.emit('user-login', { id: 1 });
        }
      });
    </script>`
  });
  await vscode.window.showTextDocument(examplesDocument);
  await new Promise(resolve => setTimeout(resolve, 250));
  for (const [needle, delta] of [['in items', 4], ["'theme'", 2], ['$refs.description', 8], ["'user-login'", 2]] as const) {
    const needleOffset = examplesDocument.getText().indexOf(needle) + delta;
    const linked = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', examplesDocument.uri, examplesDocument.positionAt(needleOffset)
    );
    assert.ok(linked.length > 0, `No GyosJS definition for ${needle}`);
  }
  const apiOffset = examplesDocument.getText().indexOf('Gyos.provide') + 'Gyos.'.length + 2;
  const apiHover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider', examplesDocument.uri, examplesDocument.positionAt(apiOffset)
  );
  assert.ok(apiHover.length > 0, 'Gyos.provide hover is missing');
  const transitionOffset = examplesDocument.getText().indexOf('g-transition="fade"') + 'g-transition="'.length + 1;
  const transitionHover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider', examplesDocument.uri, examplesDocument.positionAt(transitionOffset)
  );
  assert.ok(transitionHover.length > 0, 'g-transition value hover is missing');
  for (const [needle, delta] of [["'globalTheme'", 2], ['$refs.inlineRef', 8]] as const) {
    const linked = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', examplesDocument.uri,
      examplesDocument.positionAt(examplesDocument.getText().indexOf(needle) + delta)
    );
    assert.ok(linked.length > 0, `No inline-scope definition for ${needle}`);
  }
  const injectOffset = examplesDocument.getText().indexOf('Gyos.inject') + 'Gyos.'.length + 2;
  const injectHover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider', examplesDocument.uri, examplesDocument.positionAt(injectOffset)
  );
  assert.ok(injectHover.length > 0, 'Gyos.inject hover is missing inside inline g-scope');

  const apiCompletionDocument = await vscode.workspace.openTextDocument({ language: 'html', content: '<script>Gyos.</script>' });
  const apiCompletions = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider', apiCompletionDocument.uri, new vscode.Position(0, 13), '.'
  );
  assert.ok(apiCompletions.items.some(item => item.label === 'provide'));
  assert.ok(apiCompletions.items.some(item => item.label === 'emit'));
  assert.ok(apiCompletions.items.some(item => item.label === 'setCspNonce'));
  const versionCompletion = apiCompletions.items.find(item => item.label === 'version');
  assert.ok(versionCompletion);
  assert.equal(versionCompletion.kind, vscode.CompletionItemKind.Property);

  const cspDocument = await vscode.workspace.openTextDocument({
    language: 'html',
    content: '<script type="module">import CspGyos from \'gyosjs/csp\'; CspGyos.setCspNonce(() => document.querySelector(\'meta[name="csp-nonce"]\')?.content);</script>'
  });
  const cspOffset = cspDocument.getText().indexOf('setCspNonce') + 3;
  const cspHover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider', cspDocument.uri, cspDocument.positionAt(cspOffset)
  );
  assert.ok(cspHover.length > 0, 'Aliased setCspNonce hover is missing for the CSP entry');

  const versionDocument = await vscode.workspace.openTextDocument({ language: 'html', content: '<span g-text="Gyos.version"></span>' });
  const versionOffset = versionDocument.getText().indexOf('version') + 2;
  const versionHover = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider', versionDocument.uri, versionDocument.positionAt(versionOffset)
  );
  assert.ok(versionHover.length > 0, 'Gyos.version property hover is missing');
  const providerCompletionOffset = examplesDocument.getText().indexOf("$inject('theme')") + "$inject('th".length;
  const providerItems = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider', examplesDocument.uri, examplesDocument.positionAt(providerCompletionOffset)
  );
  assert.ok(providerItems.items.some(item => item.label === 'theme'));
  const eventCompletionOffset = examplesDocument.getText().indexOf("Gyos.emit('user-login'") + "Gyos.emit('user".length;
  const eventItems = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider', examplesDocument.uri, examplesDocument.positionAt(eventCompletionOffset)
  );
  assert.ok(eventItems.items.some(item => item.label === 'user-login'));
  const semanticIndex = new WorkspaceIndex();
  semanticIndex.updateDocument(examplesDocument);
  const semanticTokens = new GyosSemanticTokensProvider(semanticIndex).provideDocumentSemanticTokens(examplesDocument);
  assert.ok(semanticTokens.data.length > 0, 'Examples coverage document produced no semantic tokens');
  semanticIndex.dispose();

  await new Promise(resolve => setTimeout(resolve, 250));
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  assert.ok(diagnostics.some(item => item.code === 'invalid-model-modifier'));
}
