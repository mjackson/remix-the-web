import * as assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { createContext, ContextProvider } from './context.ts';

describe('context', () => {
  it('creates a context object with an undefined default value by default', () => {
    let context = createContext();
    assert.deepEqual(context, { defaultValue: undefined });
  });

  it('creates a context object with a default value', () => {
    let context = createContext({ userId: 'guest' });
    assert.deepEqual(context, { defaultValue: { userId: 'guest' } });
  });
});

describe('context provider', () => {
  let provider: ContextProvider;
  beforeEach(() => {
    provider = new ContextProvider();
  });

  it('returns the default context value when no value has been set', () => {
    let context = createContext<{ userId: string }>({ userId: 'guest' });
    assert.deepEqual(provider.get(context), { userId: 'guest' });
  });

  it('returns the value of a context object when it has been set', () => {
    let context = createContext<{ username: string }>();
    provider.set(context, { username: 'mj' });
    assert.deepEqual(provider.get(context), { username: 'mj' });
  });

  it('allows null to be used as a default context value', () => {
    let context = createContext<{ username: string } | null>(null);
    assert.deepEqual(provider.get(context), null);
  });

  it('allows null to be used as a context value', () => {
    let context = createContext<{ username: string } | null>();
    provider.set(context, null);
    assert.deepEqual(provider.get(context), null);
  });

  it('throws when no value has been set and no default value is provided', () => {
    let context = createContext<{ username: string }>();
    assert.throws(() => provider.get(context), { message: 'No value found for context' });
  });
});
