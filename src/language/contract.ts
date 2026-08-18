export const GYOS_CONTRACT_VERSION = '0.3';
export const DOCS_BASE = 'https://github.com/gyosjs/gyosjs/blob/main/docs/en';

export type AttributeKind =
  | 'directive'
  | 'structural'
  | 'router'
  | 'binding'
  | 'event'
  | 'data'
  | 'method';

export interface AttributeDefinition {
  name: string;
  kind: AttributeKind;
  syntax: string;
  description: string;
  example: string;
  docs: string;
  tags?: readonly string[];
  values?: readonly string[];
  valueRequired?: boolean;
}

function definition(
  name: string,
  kind: AttributeKind,
  description: string,
  example: string,
  docs: string,
  options: Partial<AttributeDefinition> = {}
): AttributeDefinition {
  return { name, kind, syntax: name, description, example, docs, ...options };
}

export const STRUCTURAL_ATTRIBUTES = [
  definition('*if', 'structural', 'Render this branch while its expression is truthy.', '<p *if="visible">Visible</p>', 'api-reference.md#structural-directives', { valueRequired: true }),
  definition('*elseif', 'structural', 'Continue an adjacent *if chain with another condition.', '<p *elseif="step === 2">Step two</p>', 'api-reference.md#if-elseif-else', { valueRequired: true }),
  definition('*else', 'structural', 'Render the fallback branch of an adjacent *if chain.', '<p *else>Fallback</p>', 'api-reference.md#if-elseif-else'),
  definition('*for', 'structural', 'Repeat an element for each value in an iterable expression.', '<li *for="item, index in items" g-key="item.id">{item.label}</li>', 'api-reference.md#for', { valueRequired: true }),
  definition('*switch', 'structural', 'Select one direct *case or *default child.', '<div *switch="status">...</div>', 'api-reference.md#switch-case-default', { valueRequired: true }),
  definition('*case', 'structural', 'Match a value inside a direct *switch parent.', '<p *case="\'ready\'">Ready</p>', 'api-reference.md#switch-case-default', { valueRequired: true }),
  definition('*default', 'structural', 'Provide the fallback child inside a direct *switch parent.', '<p *default>Unknown</p>', 'api-reference.md#switch-case-default'),
  definition('*await', 'structural', 'Render pending, resolved, and rejected branches for a Promise.', '<div *await="request">...</div>', 'api-reference.md#await-pending-then-catch', { valueRequired: true }),
  definition('*pending', 'structural', 'Render while the direct *await parent is pending.', '<p *pending>Loading...</p>', 'api-reference.md#await-pending-then-catch'),
  definition('*then', 'structural', 'Render a resolved *await value and optionally name it.', '<p *then="result">{result.title}</p>', 'api-reference.md#await-pending-then-catch'),
  definition('*catch', 'structural', 'Render a rejected *await error and optionally name it.', '<p *catch="error">{error.message}</p>', 'api-reference.md#await-pending-then-catch')
] as const;

export const DIRECTIVE_ATTRIBUTES = [
  definition('g-scope', 'directive', 'Create a local reactive scope from an inline object or registered name.', '<div g-scope="CounterApp">...</div>', 'api-reference.md#g-scope'),
  definition('g-scope-persist', 'directive', 'Reuse a cached scope instance by a stable key across remounts.', '<div g-scope="Player" g-scope-persist="audio-player">...</div>', 'api-reference.md#g-scope', { valueRequired: true }),
  definition('g-model', 'directive', 'Two-way bind an input, textarea, or select to a writable scope path.', '<input g-model.trim="user.name">', 'api-reference.md#g-model', { tags: ['input', 'textarea', 'select'], valueRequired: true }),
  definition('g-show', 'directive', 'Toggle element visibility without removing it from the DOM.', '<div g-show="open">Menu</div>', 'api-reference.md#g-show', { valueRequired: true }),
  definition('g-text', 'directive', 'Set textContent from an expression.', '<span g-text="message"></span>', 'api-reference.md#g-text', { valueRequired: true }),
  definition('g-html', 'directive', 'Set trusted innerHTML from an expression.', '<div g-html="trustedMarkup"></div>', 'api-reference.md#g-html', { valueRequired: true }),
  definition('g-ref', 'directive', 'Expose this element through the current scope $refs object.', '<input g-ref="emailInput">', 'api-reference.md#g-ref', { valueRequired: true }),
  definition('g-static', 'directive', 'Process this element once and freeze its GyosJS subtree.', '<h1 g-static>{title}</h1>', 'api-reference.md#g-static'),
  definition('g-ignore', 'directive', 'Leave this element and its entire subtree untouched by GyosJS.', '<div g-ignore>Third-party widget</div>', 'api-reference.md#g-ignore'),
  definition('g-key', 'directive', 'Provide stable identity for a *for row.', '<li *for="item in items" g-key="item.id">...</li>', 'api-reference.md#for', { valueRequired: true }),
  definition('g-transition', 'directive', 'Animate structural enter/leave or g-show visibility using a built-in or custom transition.', '<div g-show="open" g-transition.300="fade">...</div>', 'api-reference.md#g-transition', { valueRequired: true }),
  definition('g-portal', 'directive', 'Move a conditional element to a target elsewhere in the document.', '<div *if="open" g-portal="#modal-root">...</div>', 'api-reference.md#g-portal', { valueRequired: true }),
  definition('g-hydrate', 'directive', 'Delay mounting a g-scope until a hydration strategy activates.', '<aside g-scope="Sidebar" g-hydrate="visible">...</aside>', 'api-reference.md#g-hydrate', { values: ['idle', 'visible', 'interaction', 'media(max-width: 768px)'], valueRequired: true }),
  definition('g-reveal', 'directive', 'Mark an element when it enters the viewport; application CSS owns the animation.', '<article g-reveal>Project card</article>', 'api-reference.md#g-reveal'),
  definition('g-provide', 'directive', 'Provide a JSON object to descendant scopes.', '<section g-provide=\'{"theme":"dark"}\'>...</section>', 'api-reference.md#g-provide', { valueRequired: true }),
  definition('g-form', 'directive', 'Expose reactive validation state for a form.', '<form g-form="signupForm">...</form>', 'api-reference.md#g-form-g-validate-g-errors', { tags: ['form'], valueRequired: true }),
  definition('g-submit', 'directive', 'Call a scope method after a g-form passes validation.', '<form g-form="signupForm" g-submit="saveAccount">...</form>', 'api-reference.md#g-submit', { tags: ['form'], valueRequired: true }),
  definition('g-validate', 'directive', 'Apply pipe-separated validators to a form control.', '<input g-model="email" g-validate="required|email">', 'api-reference.md#g-form-g-validate-g-errors', { tags: ['input', 'textarea', 'select'], valueRequired: true }),
  definition('g-errors', 'directive', 'Render validation errors from a named g-form state.', '<div g-errors="signupForm"></div>', 'api-reference.md#g-form-g-validate-g-errors', { valueRequired: true }),
  definition('g-cloak', 'directive', 'Remove the cloak attribute after mounting, optionally after a delay.', '<div g-cloak>...</div>', 'api-reference.md#built-in-attribute-directives'),
  definition('g-focus', 'directive', 'Focus the element when its directive mounts.', '<input g-focus>', 'api-reference.md#built-in-attribute-directives'),
  definition('g-tooltip', 'directive', 'Set the element title from a reactive expression.', '<button g-tooltip="helpText">Help</button>', 'api-reference.md#built-in-attribute-directives', { valueRequired: true }),
  definition('g-markdown', 'directive', 'Render the built-in safe Markdown subset from an expression.', '<article g-markdown="content"></article>', 'api-reference.md#built-in-attribute-directives', { valueRequired: true }),
  definition('g-on', 'directive', 'Subscribe to a scope-channel event with a handler.', '<div g-on:refresh="reload"></div>', 'api-reference.md#built-in-attribute-directives', { valueRequired: true }),
  definition('g-ignore-outside-click', 'directive', 'Exclude a trigger from outside-click handling.', '<button g-ignore-outside-click @click="open = !open">Toggle</button>', 'api-reference.md#events')
] as const;

export const ROUTER_ATTRIBUTES = [
  definition('g-boost', 'router', 'Enable same-origin MPA Boost navigation for this element or subtree.', '<body g-boost>...</body>', 'mpa-boost-deep-dive.md'),
  definition('g-no-boost', 'router', 'Keep this element and subtree on native browser navigation.', '<a g-no-boost href="/download">Download</a>', 'mpa-boost-deep-dive.md#g-no-boost'),
  definition('g-outlet', 'router', 'Mark a target region that receives boosted HTML.', '<main id="app" g-outlet>...</main>', 'mpa-boost-deep-dive.md#g-outlet'),
  definition('g-target', 'router', 'Select a target in the current document for a partial swap.', '<a href="/profile" g-target="#sidebar">Profile</a>', 'mpa-boost-deep-dive.md#g-target', { valueRequired: true }),
  definition('g-swap', 'router', 'Choose how incoming HTML is applied to the selected target.', '<button g-swap="append">More</button>', 'mpa-boost-deep-dive.md#g-swap', { values: ['inner', 'replace', 'append', 'prepend', 'morph'], valueRequired: true }),
  definition('g-preload', 'router', 'Preload an eligible GET link on mouseover.', '<a href="/posts" g-preload>Posts</a>', 'mpa-boost-deep-dive.md#g-preload'),
  definition('g-snapshot', 'router', 'Cache incoming HTML for history restoration.', '<main g-outlet g-snapshot>...</main>', 'mpa-boost-deep-dive.md#g-snapshot'),
  definition('g-persist', 'router', 'Keep the real keyed DOM island across destructive swaps.', '<audio g-persist="player"></audio>', 'mpa-boost-deep-dive.md#g-persist', { valueRequired: true }),
  definition('g-current-head', 'router', 'Keep the current document head during this navigation.', '<a g-current-head href="/partial">Refresh</a>', 'mpa-boost-deep-dive.md#g-current-head'),
  definition('g-change-state', 'router', 'Push history for a custom or partial navigation.', '<button g-router-link="/cart" g-change-state>Cart</button>', 'mpa-boost-deep-dive.md#g-change-state'),
  definition('g-current-state', 'router', 'Keep the current URL and history entry.', '<button g-router-link="/panel" g-current-state>Refresh</button>', 'mpa-boost-deep-dive.md#g-current-state'),
  definition('g-noscroll', 'router', 'Preserve scroll position for this navigation.', '<a href="/filter" g-noscroll>Filter</a>', 'mpa-boost-deep-dive.md#g-noscroll'),
  definition('g-router-spin', 'router', 'Show a temporary spinner in the selected target.', '<button g-router-spin g-router-link="/panel">Load</button>', 'mpa-boost-deep-dive.md#g-router-spin'),
  definition('g-router-link', 'router', 'Turn any element into a same-origin router trigger.', '<button g-router-link="/cart/items">Add</button>', 'mpa-boost-deep-dive.md#g-router-link', { valueRequired: true }),
  definition('g-router-method', 'router', 'Set the HTTP method for g-router-link.', '<button g-router-link="/items" g-router-method="POST">Create</button>', 'mpa-boost-deep-dive.md#g-router-link', { values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], valueRequired: true }),
  definition('g-router-params', 'router', 'Evaluate query parameters or a JSON body for g-router-link.', '<button g-router-params="{ page: 2 }">More</button>', 'mpa-boost-deep-dive.md#g-router-link', { valueRequired: true }),
  definition('g-script-once', 'router', 'Execute a matching script URL or inline-content hash only once.', '<script g-script-once src="/app.js"></script>', 'layouts-scripts-lifecycle.md'),
  definition('g-script-wrap', 'router', 'Execute an inline page script in an isolated function scope.', '<script g-script-wrap>...</script>', 'layouts-scripts-lifecycle.md')
] as const;

export const BINDING_ATTRIBUTES = [
  'class', 'style', 'disabled', 'readonly', 'checked', 'selected', 'required',
  'value', 'name', 'min', 'max', 'minlength', 'maxlength', 'pattern', 'autocomplete',
  'src', 'href', 'alt', 'title', 'role', 'tabindex',
  'aria-expanded', 'aria-current', 'aria-hidden', 'data-state'
] as const;
export const COMMON_EVENTS = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'keypress', 'focus', 'blur', 'mouseenter', 'mouseleave'] as const;
export const EVENT_MODIFIERS = ['prevent', 'stop', 'once', 'capture', 'passive', 'debounce', 'outside', 'global'] as const;
export const KEY_MODIFIERS = ['enter', 'esc', 'escape', 'space', 'up', 'down', 'left', 'right', 'delete', 'tab'] as const;
export const MODEL_MODIFIERS = ['debounce', 'number', 'trim'] as const;
export const TRANSITIONS = ['fade', 'slide-down', 'slide-up', 'slide-left', 'slide-right', 'scale', 'zoom'] as const;
export const VALIDATORS = ['required', 'email', 'minLength', 'maxLength', 'min', 'max', 'number', 'integer', 'numeric', 'alpha', 'alphanumeric', 'pattern', 'same', 'different', 'url', 'phone', 'date', 'before', 'after', 'password', 'in', 'notIn', 'between'] as const;

export const ALL_DEFINITIONS: readonly AttributeDefinition[] = [
  ...STRUCTURAL_ATTRIBUTES,
  ...DIRECTIVE_ATTRIBUTES,
  ...ROUTER_ATTRIBUTES
];

const exactDefinitions = new Map(ALL_DEFINITIONS.map(item => [item.name, item]));

export function documentationUrl(definition: AttributeDefinition): string {
  return `${DOCS_BASE}/${definition.docs}`;
}

export function findDefinition(attributeName: string): AttributeDefinition | undefined {
  const lower = attributeName.toLowerCase();
  const exact = exactDefinitions.get(lower);
  if (exact) return exact;

  if (lower.startsWith('g-model.')) return exactDefinitions.get('g-model');
  if (lower.startsWith('g-transition.')) return exactDefinitions.get('g-transition');
  if (lower.startsWith('g-reveal:')) return exactDefinitions.get('g-reveal');
  if (lower.startsWith('g-on:')) return exactDefinitions.get('g-on');
  if (lower.startsWith(':') && lower.length > 1) {
    return definition(':attribute', 'binding', 'Reactively bind a safe HTML, ARIA, data, form, or custom attribute.', '<button :aria-expanded="open">Menu</button>', 'api-reference.md#attribute-bindings');
  }
  if (lower.startsWith('@') && lower.length > 1) {
    return definition('@event', 'event', 'Run a scope method or expression for a DOM event.', '<button @click.prevent="submit">Save</button>', 'api-reference.md#events');
  }
  if (lower.startsWith('gd-') && lower.length > 3) {
    return definition('gd-*', 'data', 'Define auto-scope data from an HTML attribute.', '<div gd-count="0">{count}</div>', 'api-reference.md#auto-scope-attributes-gd-and-gm');
  }
  if (lower.startsWith('gm-') && lower.length > 3) {
    return definition('gm-*', 'method', 'Define an auto-scope method, optionally with colon-separated arguments.', '<div gm-add:amount="count += amount">...</div>', 'api-reference.md#auto-scope-attributes-gd-and-gm');
  }
  return undefined;
}
