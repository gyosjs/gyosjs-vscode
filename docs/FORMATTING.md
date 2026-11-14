# HTML formatting and text interpolation

Investigated 2026-11-14 after the same authoring issue occurred in Rivergate and Sumboard. This is formatter damage to JavaScript text, not a proposal to accept malformed strings in the runtime.

## Reproduce

From this repository, run:

```sh
npx prettier@3.9.6 --config tests/fixtures/formatting/prettier.json tests/fixtures/formatting/before.html
```

The output is saved in `tests/fixtures/formatting/after.html`. The input is one valid HTML text interpolation, with a long single-quoted sentence. With the HTML parser, width 80 and whitespace sensitivity `css`, the formatter inserts a physical newline between `continue` and `editing`, inside the string. Repeating with `strict` and `ignore` also breaks that same sentence. These whitespace options do not make the HTML parser understand GyosJS expressions.

Observed with GyosJS 0.5.5 bundles in Playwright 1.55.1 on Windows, across Chromium, Firefox and WebKit, in both standard and CSP modes (36 runs: six variants × two builds × three engines):

| Variant | Text shown |
| --- | --- |
| Original input | Complete sentence |
| Formatted HTML, `css` / `strict` / `ignore` | Empty |
| `<!-- prettier-ignore -->` immediately before the paragraph, then format | Complete sentence |
| Same expression moved to a `g-text` attribute, then format | Complete sentence |

The invalid expression was contained by the runtime, so the check cannot rely on a thrown page error. It must inspect rendered content. The two alternatives above were tested with this formatter/version/config; they are not a compatibility claim for every HTML/Blade formatter.

## Authoring choices

- Prefer short template bindings and keep long display sentences in scope fields/getters or existing computed values. A scope getter is enough; this does not require migrating an object scope to low-level signals.
- `g-text` keeps the expression in an attribute. Normal HTML quote escaping still applies, and it replaces the element's contents.
- For an isolated element, use Prettier's [HTML ignore comment](https://prettier.io/docs/ignore#html). Keep the interpolation on one line inside quoted strings. Do not use `g-ignore` for this purpose: it prevents GyosJS from processing the element.
- Avoid blanket changes to `printWidth`, whitespace sensitivity or global format-on-save merely to hide one sample. Test formatted output with the actual browser/runtime.

## Diagnostic boundary

The extension scans actual text regions and warns only under an explicit `g-scope` or `gd-*`/`gm-*` owner. It reports closed single/double-quoted strings with unescaped CR/LF. LF, CRLF, CR, escaped quotes, escaped backslashes and JavaScript line continuations have regression coverage.

It excludes comments, attributes, PHP/Blade blocks and directive arguments, `g-ignore`, raw-text elements and content replaced by `g-text`/`g-html`. It deliberately skips expressions with nested opening braces, entities, template literals or slash tokens outside strings, and incomplete edits. This avoids guessing about decoded HTML, regular expressions and comments. It is not full expression validation and offers no automatic string repair.

Unit tests keep valid multiline expressions quiet and assert exact UTF-16 source ranges, including a mixed Blade/PHP fixture. Desktop and web host tests open HTML/PHP documents and a `.blade.php` document, assert the warning/range, repair the string and wait for the warning to disappear. No production dependency, formatter provider or core runtime change is introduced.
