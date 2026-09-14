export interface RuntimeApiDefinition {
  name: string;
  signature: string;
  description: string;
  docs: string;
}

const api = (name: string, signature: string, description: string, docs = 'api-reference.md'): RuntimeApiDefinition => ({
  name, signature, description, docs
});

export const GYOS_APIS: readonly RuntimeApiDefinition[] = [
  api('scope', "Gyos.scope(name, definition)\nGyos.scope(element, definition)", 'Register a named scope or mount a definition on an element.'),
  api('mount', 'Gyos.mount(element)', 'Mount the nearest GyosJS scope rooted at an element.'),
  api('mountAll', 'Gyos.mountAll(root?)', 'Mount all GyosJS scopes below a root.'),
  api('mountTree', 'Gyos.mountTree(root)', 'Mount a dynamically inserted GyosJS tree.'),
  api('cleanup', 'Gyos.cleanup(target?)', 'Dispose reactive effects owned by a target or the current cleanup context.'),
  api('mountedScopes', 'Gyos.mountedScopes()', 'Return the currently mounted scope registry.'),
  api('markRaw', 'Gyos.markRaw(value)', 'Exclude an object from deep reactive proxying.'),
  api('shallow', 'Gyos.shallow(value)', 'Create a shallow reactive object.'),
  api('directive', 'Gyos.directive(name, definition)', 'Register a custom g-* directive.'),
  api('pipe', 'Gyos.pipe(name, transform)', 'Register a template pipe.'),
  api('provide', 'Gyos.provide(key, value)', 'Register a global dependency.'),
  api('inject', 'Gyos.inject(key, defaultValue?)', 'Read a dependency registered globally with Gyos.provide(), or return the optional default.'),
  api('getGlobalContainer', 'Gyos.getGlobalContainer()', 'Return the global dependency container.'),
  api('store', 'Gyos.store(name, definition?)', 'Register or read a global reactive store.'),
  api('hasStore', 'Gyos.hasStore(name)', 'Check whether a global store exists.'),
  api('removeStore', 'Gyos.removeStore(name)', 'Remove a global store.'),
  api('getStoreNames', 'Gyos.getStoreNames()', 'Return registered store names.'),
  api('on', 'Gyos.on(event, handler)', 'Subscribe to a global event channel.'),
  api('emit', 'Gyos.emit(event, ...args)', 'Emit a global event channel.'),
  api('off', 'Gyos.off(event, handler)', 'Remove a global event listener.'),
  api('once', 'Gyos.once(event, handler)', 'Subscribe to the next occurrence of a global event.'),
  api('getEventListeners', 'Gyos.getEventListeners(event?)', 'Inspect registered global event listeners.'),
  api('clearAllEvents', 'Gyos.clearAllEvents()', 'Remove every global event listener.'),
  api('validator', 'Gyos.validator(name, validate)', 'Register a form validator.'),
  api('validate', 'Gyos.validate(value, rules, context?)', 'Validate a value against a rule expression.'),
  api('getValidator', 'Gyos.getValidator(name)', 'Return a registered validator.'),
  api('getValidatorNames', 'Gyos.getValidatorNames()', 'Return registered validator names.'),
  api('signal', 'Gyos.signal(initialValue, options?)', 'Create a writable reactive signal.'),
  api('computed', 'Gyos.computed(getter)', 'Create a derived read-only signal.'),
  api('effect', 'Gyos.effect(callback)', 'Run a reactive effect and return its disposer.'),
  api('batch', 'Gyos.batch(callback)', 'Batch reactive notifications.'),
  api('isSignal', 'Gyos.isSignal(value)', 'Check whether a value is a signal.'),
  api('isComputed', 'Gyos.isComputed(value)', 'Check whether a value is a computed signal.'),
  api('unref', 'Gyos.unref(value)', 'Read a signal/computed value or return a plain value unchanged.'),
  api('untrack', 'Gyos.untrack(callback)', 'Run code without collecting reactive dependencies.'),
  api('registerTransition', 'Gyos.registerTransition(name, config)', 'Register a named structural transition.'),
  api('getTransitionConfig', 'Gyos.getTransitionConfig(nameOrElement)', 'Return a transition configuration by name, or read a transition and duration modifier from an element.'),
  api('useFetch', 'Gyos.useFetch(url, options?)', 'Create reactive fetch state.'),
  api('useCounter', 'Gyos.useCounter(initialValue?)', 'Create reusable counter state and actions.'),
  api('useToggle', 'Gyos.useToggle(initialValue?)', 'Create reusable boolean toggle state.'),
  api('useLocalStorage', 'Gyos.useLocalStorage(key, initialValue)', 'Synchronize reactive state with localStorage.'),
  api('useInterval', 'Gyos.useInterval(callback, delay)', 'Run a lifecycle-aware interval.'),
  api('useTimeout', 'Gyos.useTimeout(callback, delay)', 'Run a lifecycle-aware timeout.'),
  api('useDebounce', 'Gyos.useDebounce(value, delay)', 'Create a debounced reactive value.'),
  api('useThrottle', 'Gyos.useThrottle(value, delay)', 'Create a throttled reactive value.'),
  api('useMouse', 'Gyos.useMouse()', 'Create reactive pointer coordinates.'),
  api('useWindowSize', 'Gyos.useWindowSize()', 'Create reactive viewport dimensions.'),
  api('useMediaQuery', 'Gyos.useMediaQuery(query)', 'Create reactive media-query state.'),
  api('useAsync', 'Gyos.useAsync(factory)', 'Create reactive asynchronous task state.'),
  api('nextTick', 'Gyos.nextTick(callback?)', 'Wait for the next microtask.'),
  api('debounce', 'Gyos.debounce(callback, delay)', 'Create a debounced function.'),
  api('throttle', 'Gyos.throttle(callback, delay)', 'Create a throttled function.'),
  api('ready', 'Gyos.ready(callback)', 'Run a callback when the document is ready.'),
  api('applyDirective', 'Gyos.applyDirective(element, name, value, scope?)', 'Apply a registered directive manually.'),
  api('applyTransitionStyles', 'Gyos.applyTransitionStyles()', 'Install transition styles used by built-in transitions.'),
  api('setCspNonce', 'Gyos.setCspNonce(valueOrResolver?)', 'Configure the active CSP nonce used for scripts recreated by MPA Boost.', 'content-security-policy.md'),
  api('startRouter', 'Gyos.startRouter(options?)', 'Start MPA Boost when g-boost is present.', 'mpa-boost-deep-dive.md'),
  api('onBeforeNavigate', 'Gyos.onBeforeNavigate((url, context) => {}) => unsubscribe', 'Subscribe at request start. Keep page resources alive until an accepted swap.', 'api-reference.md#router-hooks'),
  api('onBeforeSwap', 'Gyos.onBeforeSwap((url, context) => {}) => unsubscribe', 'Subscribe immediately before an accepted swap, for external widget cleanup. Rejected responses skip this hook.', 'api-reference.md#router-hooks'),
  api('onAfterNavigate', 'Gyos.onAfterNavigate((url, context) => {}) => unsubscribe', 'Subscribe after the swap pipeline completes, including opted-in HTTP error HTML.', 'api-reference.md#router-hooks'),
  api('onNavigationEnd', 'Gyos.onNavigationEnd(context => {}) => unsubscribe', 'Receive each navigation outcome, status, committed state and fallback flag, including failures and cancellation.', 'api-reference.md#router-hooks'),
  api('portalCreate', 'Gyos.portalCreate(element, target)', 'Move an element into a portal target.'),
  api('portalDestroy', 'Gyos.portalDestroy(element)', 'Restore or destroy a portal element.'),
  api('version', 'Gyos.version', 'Current GyosJS runtime version.')
];

export const CONTEXT_APIS: readonly RuntimeApiDefinition[] = [
  api('$refs', 'this.$refs.name\n$refs.name', 'Elements declared with g-ref in the active scope.', 'api-reference.md#g-ref'),
  api('$inject', 'this.$inject(key)\n$inject(key)', 'Read the nearest g-provide dependency, then fall back to global providers.'),
  api('$provide', 'this.$provide(key, value)\n$provide(key, value)', 'Provide a dependency from the active component context.'),
  api('$emit', 'this.$emit(event, ...args)\n$emit(event, ...args)', 'Emit an event on the active scope channel.'),
  api('$on', 'this.$on(event, handler)\n$on(event, handler)', 'Subscribe to an event on the active scope channel.'),
  api('$watch', 'this.$watch(path, handler, options?)', 'Watch a reactive scope path.'),
  api('$effect', 'this.$effect(callback)', 'Create an effect owned by the active scope.'),
  api('$index', '$index', 'Zero-based index automatically exposed by *for.'),
  api('$event', '$event', 'Native DOM event exposed inside @event handlers.')
];

export const FORM_CONTEXT_METHODS: readonly RuntimeApiDefinition[] = [
  api('$valid', 'form.$valid()', 'Return true when every registered field is valid.'),
  api('$invalid', 'form.$invalid()', 'Return true when any registered field is invalid.'),
  api('$dirty', 'form.$dirty()', 'Return true after form state has changed.'),
  api('$pristine', 'form.$pristine()', 'Return true while the form remains pristine.')
];

export const BUILTIN_PIPES = [
  'currency', 'date', 'slug', 'truncate', 'uppercase', 'lowercase', 'capitalize', 'fallback',
  'json', 'number', 'pluralize', 'percent', 'join', 'limit', 'reverse'
] as const;

export function findGyosApi(name: string): RuntimeApiDefinition | undefined {
  return GYOS_APIS.find(definition => definition.name === name);
}

export function findContextApi(name: string): RuntimeApiDefinition | undefined {
  return CONTEXT_APIS.find(definition => definition.name === name)
    ?? FORM_CONTEXT_METHODS.find(definition => definition.name === name);
}
