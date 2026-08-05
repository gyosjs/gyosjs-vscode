import { describe, expect, it } from 'vitest';
import { attributeAtOffset, getAttribute, scanTemplate } from '../../src/language/scanner';

describe('template scanner', () => {
  it('tracks multiline elements, attributes, and hierarchy', () => {
    const source = `<main g-scope="App">
      <button
        @click.once="save"
        :disabled="busy">Save</button>
    </main>`;
    const scan = scanTemplate(source);
    const button = scan.elements.find(element => element.tagName === 'button')!;

    expect(button.parent?.tagName).toBe('main');
    expect(getAttribute(button, '@click.once')?.value).toBe('save');
    expect(getAttribute(button, ':disabled')?.value).toBe('busy');
    const offset = source.indexOf('@click') + 2;
    expect(attributeAtOffset(scan, offset)?.attribute.name).toBe('@click.once');
  });

  it('keeps PHP and Blade server blocks opaque', () => {
    const source = `<?php $value = '<div g-scope="Wrong">'; ?>
      <div @class(['active' => $active, 'wide' => fn ($x) => $x > 1]) g-scope="Page">
        {{ '<span *if="wrong">' }}
        <p *if="visible">Visible</p>
      </div>`;
    const scan = scanTemplate(source);

    expect(scan.elements.filter(element => getAttribute(element, 'g-scope'))).toHaveLength(1);
    expect(scan.elements.some(element => getAttribute(element, '*if')?.value === 'visible')).toBe(true);
  });

  it('marks the entire g-ignore subtree and skips script markup', () => {
    const source = `<section g-ignore><div *if="ignored"></div></section>
      <script>const fake = '<div g-scope="Wrong"></div>';</script>
      <div g-scope="Real"></div>`;
    const scan = scanTemplate(source);
    const ignored = scan.elements.find(element => getAttribute(element, '*if'))!;

    expect(ignored.ignored).toBe(true);
    expect(scan.elements.filter(element => getAttribute(element, 'g-scope'))).toHaveLength(1);
  });

  it('applies common optional closing rules and keeps text containers opaque', () => {
    const source = `<ul><li *if="first">First<li *else>Second</ul>
      <table><tr><td g-scope>One<td :title="label">Two</table>
      <textarea><div g-scope="Wrong"></div></textarea>
      <title><span *if="wrong"></span></title>`;
    const scan = scanTemplate(source);
    const listItems = scan.elements.filter(element => element.tagName === 'li');
    const cells = scan.elements.filter(element => element.tagName === 'td');

    expect(listItems[0].parent).toBe(listItems[1].parent);
    expect(cells[0].parent).toBe(cells[1].parent);
    expect(scan.elements.filter(element => getAttribute(element, 'g-scope'))).toHaveLength(1);
    expect(scan.elements.some(element => getAttribute(element, '*if')?.value === 'wrong')).toBe(false);
  });
});
