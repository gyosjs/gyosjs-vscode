import { describe, expect, it } from 'vitest';
import { analyzeTemplate } from '../../src/language/diagnostics';

function codes(source: string): string[] {
  return analyzeTemplate(source).map(issue => issue.code);
}

describe('conservative template diagnostics', () => {
  it('accepts GyosJS 0.4 router attributes without treating literal keys/statuses as expressions', () => {
    const source = `<head><script src="/sdk.js" g-head-persist="analytics"></script></head>
      <body g-boost><main g-outlet><form action="/save" method="post" g-boost-errors="422, 429">
      <button>Save</button></form><a href="/items?page=2" g-swap="append" g-router-remove>More</a></main></body>`;
    expect(analyzeTemplate(source)).toEqual([]);
  });
  it('accepts representative valid GyosJS templates', () => {
    const source = `<body g-boost>
      <main g-scope="Page" g-outlet>
        <form g-form="signup" g-submit="save">
          <input g-model.trim="user.email" g-validate="required|email">
        </form>
        <ul><li *for="item, index in items" g-key="item.id">{item.label}</li></ul>
        <div *if="open" g-portal="#modal" g-transition.300="fade"></div>
      </main>
    </body>`;
    expect(analyzeTemplate(source)).toEqual([]);
  });

  it('finds deterministic structural and companion errors', () => {
    const source = `<section g-scope><div *wat="x"></div></section>
      <p *else>orphan</p>
      <p *case="'ready'">case</p>
      <div *for="items"></div>
      <div g-portal="#modal"></div>
      <div g-hydrate="visible"></div>`;
    expect(codes(source)).toEqual(expect.arrayContaining([
      'unknown-structural',
      'orphan-if-branch',
      'orphan-switch-branch',
      'invalid-for-expression',
      'portal-without-if',
      'hydrate-without-scope'
    ]));
  });

  it('accepts root-level if chains and server-rendered provide values', () => {
    const source = `<p *if="ready">Ready</p>
      <p *elseif="loading">Loading</p>
      <p *else>Idle</p>
      <div g-provide="{{ $context }}"></div>
      <div g-provide="@json($context)"></div>`;
    expect(analyzeTemplate(source)).toEqual([]);
  });

  it('finds invalid modifiers, values, paths, and unsafe bindings', () => {
    const source = `<form g-submit="save"></form>
      <input g-model.lazy="constructor.value">
      <button @click.passive.prevent="save">Save</button>
      <a g-swap="teleport"></a>
      <div g-scope><script :src="remoteScript"></script></div>`;
    expect(codes(source)).toEqual(expect.arrayContaining([
      'submit-without-form',
      'invalid-model-modifier',
      'unsafe-model-path',
      'passive-prevent',
      'invalid-enum-value',
      'active-url-binding'
    ]));
  });

  it('does not diagnose custom directives or ignored subtrees', () => {
    const source = `<div g-custom="value" @custom-event="run" g-transition="custom"></div>
      <section g-ignore><input g-model.lazy="constructor.value"></section>`;
    expect(codes(source)).toEqual(['transition-without-target']);
  });

  it('accepts generic bindings and g-show transitions while blocking executable attributes', () => {
    const source = `<section g-scope="Menu">
      <button :aria-expanded="open" :data-state="state" :custom-state="state">Menu</button>
      <input :name="fieldName" :required="required">
      <aside g-show="open" g-transition.200="fade">Panel</aside>
      <a :onclick="handler" :g-show="open">Unsafe</a>
    </section>`;
    expect(codes(source)).toEqual(['blocked-binding', 'blocked-binding']);
  });

  it('does not claim framework syntax outside a GyosJS reactive context', () => {
    const source = `<div *ngIf="ready" :unknown="value"></div>
      <x-alert :message="$message"></x-alert>`;
    expect(analyzeTemplate(source)).toEqual([]);
  });

  it('accepts descendant transitions and server-rendered directive values', () => {
    const source = `<section g-scope>
      <div *if="open"><div g-transition.150="custom"></div></div>
      <div g-swap="{{ $mode }}"></div>
      <div g-router-link="/items" g-router-method="<?= $method ?>"></div>
      <div g-hydrate="@js($strategy)" g-scope></div>
      <div g-provide="{&quot;theme&quot;:&quot;dark&quot;}"></div>
    </section>`;
    expect(analyzeTemplate(source)).toEqual([]);
  });

  it('does not throw on an invalid numeric HTML entity', () => {
    expect(codes('<div g-provide="{&quot;code&quot;:&quot;&#999999999;&quot;}"></div>')).toEqual([]);
  });

  it('finds deterministic MPA Boost contract errors', () => {
    const source = `<body g-boost>
      <main id="app" g-outlet><a g-target="#missing">Missing</a></main>
      <button g-router-method="POST" g-router-params="{ id: 1 }"></button>
      <a g-change-state g-current-state href="/items">Items</a>
      <div g-persist="player"></div><audio g-persist="player"></audio>
    </body>`;
    expect(codes(source)).toEqual(expect.arrayContaining([
      'missing-router-target', 'router-method-without-link', 'router-params-without-link',
      'conflicting-router-state', 'duplicate-persist-key'
    ]));
  });
});
