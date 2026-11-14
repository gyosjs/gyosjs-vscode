import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeTemplate } from '../../src/language/diagnostics';

const broken = `{ready ? 'Your changes have been saved successfully and you can continue\n    editing this document whenever you are ready.' : 'Waiting'}`;
const issues = (source: string) => analyzeTemplate(source).filter(issue => issue.code === 'multiline-interpolation-string');

describe('formatter-damaged interpolation', () => {
  it('accepts the saved input and diagnoses the actual Prettier 3.9.6 output', () => {
    const read = (name: string) => readFileSync(new URL(`../fixtures/formatting/${name}.html`, import.meta.url), 'utf8');
    expect(issues(read('before'))).toEqual([]);
    expect(issues(read('after'))).toHaveLength(1);
  });
  it('diagnoses only the client expression in a mixed Blade/PHP fixture', () => {
    const source = readFileSync(new URL('../fixtures/formatting/sample.blade.php', import.meta.url), 'utf8');
    const found = issues(source);
    expect(found).toHaveLength(1);
    expect(source.slice(found[0].start, found[0].end)).toContain('Your changes were saved');
  });
  it('reports the quoted string and its exact source range after HTML formatting', () => {
    const source = `<section g-scope="Page"><p>🌿 ${broken}</p></section>`;
    const found = issues(source);
    expect(found).toHaveLength(1);
    expect(source.slice(found[0].start, found[0].end)).toBe("'Your changes have been saved successfully and you can continue\n    editing this document whenever you are ready.'");
    expect(found[0].message).toContain('formatter');
  });

  it.each(['\n', '\r\n', '\r'])('reports raw %j line endings in single and double quotes', newline => {
    for (const quote of ["'", '"']) {
      expect(issues(`<main gd-ready="true">{ready ? ${quote}one${newline}two${quote} : ${quote}three${quote}}</main>`)).toHaveLength(1);
    }
  });

  it.each([
    `{ready\n ? 'one'\n : 'two'}`,
    `{ready ? 'one\\n two' : 'three'}`,
    `{ready ? 'one\\\ntwo' : 'three'}`,
    `{ready ? 'one\\\r\ntwo' : 'three'}`,
    '{`one\ntwo`}',
    '{/\'/.test(value) ? "yes" : "no"}',
    '{/* "not a string\n" */ value}',
    '{value // "not a string\n}',
    '{/* {"not a string\n"} */ value}',
    '{`literal {"one\ntwo"}`}',
    '{/\\{"one\ntwo"\\}/.test(value)}',
    '{ready ? "unfinished\n}',
    '{ready ? &quot;one\ntwo&quot; : &quot;three&quot;}',
  ])('does not guess about valid or unsupported syntax: %s', expression => {
    expect(issues(`<div g-scope>${expression}</div>`)).toEqual([]);
  });

  it('does not inspect comments, attributes, raw-text elements, server blocks or ignored trees', () => {
    const source = `<div g-scope>
      <!-- ${broken} -->
      <span title="${broken}"></span>
      <div g-ignore>${broken}<p>${broken}</p></div>
      <script>${broken}</script><style>${broken}</style>
      <textarea>${broken}</textarea><title>${broken}</title>
      <noscript>${broken}</noscript><xmp>${broken}</xmp>
      <?php echo "${broken}"; ?>
      {{ "${broken}" }} {!! "${broken}" !!}
      @if("${broken}")<span>OK</span>@endif
      @php echo "${broken}"; @endphp
      @verbatim ${broken} @endverbatim
    </div><p>${broken}</p>`;
    expect(issues(source)).toEqual([]);
  });

  it('requires a scope owner and respects content replaced by g-text/g-html', () => {
    expect(issues(`<div g-boost>${broken}</div>`)).toEqual([]);
    expect(issues(`<div g-custom>${broken}</div>`)).toEqual([]);
    expect(issues(`<div g-scope><span g-text="label">${broken}</span><div g-html="content"><p>${broken}</p></div></div>`)).toEqual([]);
    expect(issues(`<div g-scope><span>${broken}</span></div>`)).toHaveLength(1);
  });

  it('does not confuse escaped quotes or backslashes with line continuations', () => {
    const expression = "{ready ? 'it\\'s one\\\\\ntwo' : 'three'}";
    expect(issues(`<div g-scope>${expression}</div>`)).toHaveLength(1);
  });

  it('keeps markup and server boundaries separate instead of joining fragments', () => {
    expect(issues(`<div g-scope>{ready ? 'one<?php echo $part; ?>\ntwo' : 'three'}</div>`)).toEqual([]);
    expect(issues(`<div g-scope>{ready ? 'one<span></span>\ntwo' : 'three'}</div>`)).toEqual([]);
  });
});
