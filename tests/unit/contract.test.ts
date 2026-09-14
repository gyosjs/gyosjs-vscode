import { describe, expect, it } from 'vitest';
import {
  ALL_DEFINITIONS,
  BINDING_ATTRIBUTES,
  GYOS_CONTRACT_VERSION,
  TRANSITIONS,
  VALIDATORS,
  findDefinition
} from '../../src/language/contract';
import { GYOS_APIS } from '../../src/language/api';

describe('GyosJS language contract', () => {
  it('keeps exact built-in names unique', () => {
    const names = ALL_DEFINITIONS.map(definition => definition.name);
    expect(new Set(names).size).toBe(names.length);
    expect(GYOS_CONTRACT_VERSION).toBe('0.4');
  });

  it('covers the GyosJS 0.3 CSP public surface', () => {
    expect(GYOS_APIS.find(api => api.name === 'setCspNonce')).toMatchObject({
      signature: 'Gyos.setCspNonce(valueOrResolver?)',
      docs: 'content-security-policy.md'
    });
    expect(GYOS_APIS.find(api => api.name === 'version')?.signature).toBe('Gyos.version');
  });

  it('covers dynamic GyosJS attribute families', () => {
    expect(findDefinition('g-boost-errors')?.valueRequired).toBe(true);
    expect(findDefinition('g-head-persist')?.tags).toContain('script');
    expect(findDefinition('g-router-remove')?.kind).toBe('router');
    expect(GYOS_APIS.find(api => api.name === 'onBeforeSwap')?.signature).toContain('unsubscribe');
    expect(GYOS_APIS.find(api => api.name === 'onNavigationEnd')?.signature).toContain('context');
    expect(findDefinition('g-model.debounce.300')?.name).toBe('g-model');
    expect(findDefinition('g-scope-persist')?.name).toBe('g-scope-persist');
    expect(findDefinition('g-transition.500')?.name).toBe('g-transition');
    expect(findDefinition('g-reveal')?.name).toBe('g-reveal');
    expect(findDefinition('g-reveal:repeat:parent')?.name).toBe('g-reveal');
    expect(findDefinition('@keydown.enter')?.kind).toBe('event');
    expect(findDefinition(':class')?.kind).toBe('binding');
    expect(findDefinition(':aria-expanded')?.description).toContain('ARIA');
    expect(findDefinition('gd-count')?.kind).toBe('data');
    expect(findDefinition('gm-add:amount')?.kind).toBe('method');
  });

  it('contains the frozen binding, transition, and validator catalogs', () => {
    expect(BINDING_ATTRIBUTES).toContain('href');
    expect(BINDING_ATTRIBUTES).toEqual(expect.arrayContaining(['aria-expanded', 'data-state', 'name', 'required']));
    expect(TRANSITIONS).toEqual(expect.arrayContaining(['fade', 'slide-down', 'zoom']));
    expect(VALIDATORS).toEqual(expect.arrayContaining(['required', 'email', 'between', 'notIn']));
  });
});
