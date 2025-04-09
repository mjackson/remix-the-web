import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { matcher } from './match.ts';

describe('match', () => {
  it('matches optionals and params', () => {
    const match = matcher([
      'http(s)://(:sub.)remix.run/products/:id(/v:version)',
      'http://react-router.com/blog/:slug',
    ]);
    const route = match('http://remix.run/products/1/v7').next().value!;
    assert.deepStrictEqual(
      route.pattern.source,
      'http(s)://(:sub.)remix.run/products/:id(/v:version)',
    );
    assert.deepStrictEqual(route.variant, {
      protocol: 'http',
      hostname: ['run', 'remix'],
      pathname: ['products', ':', 'v:'],
      search: '',
      paramSlots: [
        ['sub', false],
        ['id', true],
        ['version', true],
      ],
    });
    assert.deepStrictEqual(route.params, { sub: [undefined], id: ['1'], version: ['7'] });
  });

  it('matches repeated params', () => {
    const match = matcher(['http://remix.run/:id/:foo/:id/:id/:bar']);
    const matches = match('http://remix.run/1/2/3/4/5');
    const route = matches.next().value!;
    assert.deepStrictEqual(route.params, { id: ['1', '3', '4'], foo: ['2'], bar: ['5'] });
  });

  it('matches param name based on variant', () => {
    const match = matcher(['http://remix.run/blog/:slug', 'http://remix.run/blog/:id/edit']);

    const route1 = match('http://remix.run/blog/1').next().value!;
    assert.deepStrictEqual(route1.pattern.source, 'http://remix.run/blog/:slug');
    assert.deepStrictEqual(route1.params, { slug: ['1'] });

    const route2 = match('http://remix.run/blog/2/edit').next().value!;
    assert.deepStrictEqual(route2.pattern.source, 'http://remix.run/blog/:id/edit');
    assert.deepStrictEqual(route2.params, { id: ['2'] });
  });

  it('ranks matches based on static prefix lengths', () => {
    const match = matcher([
      'http://remix.run/:foo-two-:baz',
      'http://remix.run/one-two-:baz',
      'http://remix.run/:foo-two-three',
      'http://remix.run/one-:bar-:baz',
      'http://remix.run/one-:bar-three',
      'http://remix.run/:foo-:bar-three',
      'http://remix.run/:foo-:bar-:baz',
      'http://remix.run/one-two-three',
      'http://remix.run/:foobarbaz',
      // parse('http://remix.run/*'),
    ]);

    const matches = Array.from(match('http://remix.run/one-two-three'));
    const sources = matches.map((m) => m.pattern.source);
    assert.deepStrictEqual(sources, [
      'http://remix.run/one-two-three',
      'http://remix.run/one-two-:baz',
      'http://remix.run/one-:bar-three',
      'http://remix.run/one-:bar-:baz',
      'http://remix.run/:foo-two-three',
      'http://remix.run/:foo-two-:baz',
      'http://remix.run/:foo-:bar-three',
      'http://remix.run/:foo-:bar-:baz',
      'http://remix.run/:foobarbaz',
    ]);
  });

  it('backtracks', () => {
    const match = matcher([
      'http://remix.run/a/b/c/d/e',
      'http://remix.run/a/b/c/:d/e',
      'http://remix.run/a/b/:c/d/e',
      'http://remix.run/a/:b/c/d/e',
      'http://remix.run/:a/b/c/d/e',
      'http://remix.run/:a/:b/:c/:d/:e',
    ]);

    const route = match('http://remix.run/a/b/c/d/z').next().value!;
    assert.deepStrictEqual(route.pattern.source, 'http://remix.run/:a/:b/:c/:d/:e');
    assert.deepStrictEqual(route.params, { a: ['a'], b: ['b'], c: ['c'], d: ['d'], e: ['z'] });
  });
});
