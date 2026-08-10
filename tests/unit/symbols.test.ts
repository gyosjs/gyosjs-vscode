import { describe, expect, it } from 'vitest';
import { scanContextAccesses, scanGyosCalls, scanJavaScriptSymbols } from '../../src/language/symbols';

describe('GyosJS symbol scanner', () => {
  it('indexes registrations and scope members without reading comments', () => {
    const source = `
      // Gyos.scope('Wrong', { nope: true })
      const sample = "Gyos.scope('AlsoWrong', { nope: true })";
      const page = { count: 0, get total() { return this.count }, increment(step = 1) {} };
      Gyos.scope('Page', page);
      Gyos.store('session', { user: null });
      Gyos.pipe('money', value => value);
      Other.scope('NotGyos', { value: true });
    `;
    const symbols = scanJavaScriptSymbols(source);
    expect(symbols.map(symbol => `${symbol.kind}:${symbol.name}`)).toEqual(expect.arrayContaining([
      'scope:Page', 'property:count', 'method:total', 'method:increment',
      'store:session', 'property:user', 'pipe:money'
    ]));
    expect(symbols.some(symbol => symbol.name === 'Wrong')).toBe(false);
    expect(symbols.some(symbol => symbol.name === 'AlsoWrong')).toBe(false);
    expect(symbols.some(symbol => symbol.name === 'NotGyos')).toBe(false);
  });

  it('recognizes imported Gyos aliases and named registrations', () => {
    const symbols = scanJavaScriptSymbols(`
      import G, { pipe as registerPipe } from 'gyosjs';
      G.scope('Page', { ready: true });
      registerPipe('upper', value => value);
    `);
    expect(symbols.map(symbol => `${symbol.kind}:${symbol.name}`)).toEqual(expect.arrayContaining([
      'scope:Page', 'property:ready', 'pipe:upper'
    ]));
  });

  it('preserves UTF-16 offsets when source contains astral characters', () => {
    const source = `const icon = "😀"; Gyos.scope('Page', { ready: true });`;
    const scope = scanJavaScriptSymbols(source).find(symbol => symbol.kind === 'scope');

    expect(scope?.start).toBe(source.indexOf('Page'));
  });

  it('links DI keys, event channels, and component context accesses', () => {
    const source = `
      Gyos.provide('theme', 'dark');
      const theme = Gyos.inject('theme');
      Gyos.on('user-login', handleLogin);
      Gyos.emit('user-login', user);
      this.$inject('localTheme');
      this.$emit('refresh');
      this.$refs.description.textContent = theme;
    `;
    const symbols = scanJavaScriptSymbols(source);
    expect(symbols.some(symbol => symbol.kind === 'provider' && symbol.name === 'theme' && symbol.role === 'declaration')).toBe(true);
    expect(symbols.some(symbol => symbol.kind === 'provider' && symbol.name === 'theme' && symbol.role === 'reference')).toBe(true);
    expect(symbols.filter(symbol => symbol.kind === 'event' && symbol.name === 'user-login')).toHaveLength(2);
    expect(symbols.some(symbol => symbol.kind === 'ref' && symbol.name === 'description' && symbol.role === 'reference')).toBe(true);
    expect(scanGyosCalls(source).some(call => call.method === '$inject' && call.argument === 'localTheme')).toBe(true);
    expect(scanContextAccesses(source).some(access => access.name === '$refs' && access.member === 'description')).toBe(true);
  });

  it('keeps call-heavy generated sources within a linear scan budget', () => {
    const source = Array.from(
      { length: 6000 },
      (_, index) => `const value${index} = "factory${index}('not-gyos')";`
    ).join('\n');
    const started = performance.now();
    const symbols = scanJavaScriptSymbols(source);
    const elapsed = performance.now() - started;

    expect(symbols).toEqual([]);
    expect(elapsed).toBeLessThan(1500);
  }, 5000);
});
