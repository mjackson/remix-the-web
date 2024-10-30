/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { createHrefBuilder } from './href-builder.js';
import { Route, MiddlewareRoute, PrefixRoute } from './router.js';
import { Assert, Equal, Pretty } from './spec-helpers.js';

describe('href builder', () => {
  it('provides type hints when no routes are provided', () => {
    type Routes = [];
    let href = createHrefBuilder<Routes>();
    type T = Assert<Equal<Parameters<typeof href>[0], never>>;
  });

  it('provides type hints for all route patterns in a route tree', () => {
    type Routes = [
      Route<'about'>,
      PrefixRoute<'blog', [Route<'edit'>, Route<':slug?'>]>,
      MiddlewareRoute<[Route<'admin'>]>,
    ];

    let href = createHrefBuilder<Routes>();

    type T = Assert<
      Equal<Parameters<typeof href>[0], '/about' | '/blog/edit' | '/blog/:slug?' | '/admin'>
    >;
  });

  it('provides type hints for all params in a pattern', () => {
    type Routes = [PrefixRoute<'blog/:category', [Route<'edit'>, Route<':slug?'>]>];

    let href = createHrefBuilder<Routes>();

    type T = Assert<
      Equal<
        Pretty<Parameters<typeof href>[1]>,
        { category: string | [string, ...string[]]; slug?: string | string[] } | undefined
      >
    >;
  });

  it('provides type hints for all search params in a pattern', () => {
    type Routes = [Route<'search?q'>];

    let href = createHrefBuilder<Routes>();

    type T = Assert<
      Equal<
        Pretty<Parameters<typeof href>[2]>,
        { q: string | [string, ...string[]]; [x: string]: string | string[] } | undefined
      >
    >;
  });

  it('builds a href with no params', () => {
    type Routes = [Route<'about'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/about'), '/about');
  });

  it('builds a href with required hostname params', () => {
    type Routes = [Route<'https://:sub.remix.run'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('https://:sub.remix.run/', { sub: 'www' }), 'https://www.remix.run/');
    assert.equal(href('https://:sub.remix.run/', { sub: ['www'] }), 'https://www.remix.run/');
  });

  it('provides type hints for required hostname params that are missing/undefined', () => {
    type Routes = [Route<'https://:sub.remix.run'>];
    let href = createHrefBuilder<Routes>();
    // @ts-expect-error We're testing the error case
    assert.equal(href('https://:sub.remix.run/', {}), 'https://undefined.remix.run/');
    // prettier-ignore
    // @ts-expect-error We're testing the error case
    assert.equal( href('https://:sub.remix.run/', { sub: undefined }), 'https://undefined.remix.run/')
    // @ts-expect-error We're testing the error case
    assert.equal(href('https://:sub.remix.run/', { sub: [] }), 'https://undefined.remix.run/');
    // prettier-ignore
    // @ts-expect-error We're testing the error case
    assert.equal(href('https://:sub.remix.run/', { sub: [undefined] }), 'https://undefined.remix.run/')
    // @ts-expect-error We're testing the error case
    assert.equal(href('https://:sub.remix.run/', { sub: null }), 'https://null.remix.run/');
  });

  it('builds a href with optional hostname params', () => {
    type Routes = [Route<'https://:sub?.remix.run'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('https://:sub?.remix.run/', { sub: 'www' }), 'https://www.remix.run/');
    assert.equal(href('https://:sub?.remix.run/', { sub: ['www'] }), 'https://www.remix.run/');
  });

  it('builds a href without optional hostname params', () => {
    type Routes = [Route<'https://:sub?.remix.run'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('https://:sub?.remix.run/', {}), 'https://remix.run/');
  });

  it('builds a href with required pathname params', () => {
    type Routes = [PrefixRoute<'blog/:category', [Route<'edit'>, Route<':slug?'>]>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/blog/:category/edit', { category: 'remix' }), '/blog/remix/edit');
    assert.equal(href('/blog/:category/edit', { category: ['remix'] }), '/blog/remix/edit');
  });

  it('provides type hints for required pathname params that are missing/undefined', () => {
    type Routes = [PrefixRoute<'blog/:category', [Route<'edit'>, Route<':slug?'>]>];
    let href = createHrefBuilder<Routes>();
    // @ts-expect-error We're testing the error case
    assert.equal(href('/blog/:category/edit', {}), '/blog/undefined/edit');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/blog/:category/edit', { category: undefined }), '/blog/undefined/edit');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/blog/:category/edit', { category: [] }), '/blog/undefined/edit');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/blog/:category/edit', { category: [undefined] }), '/blog/undefined/edit');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/blog/:category/edit', { category: null }), '/blog/null/edit');
  });

  it('builds a href with optional pathname params', () => {
    type Routes = [PrefixRoute<'blog/:category', [Route<'edit'>, Route<':slug?'>]>];
    let href = createHrefBuilder<Routes>();
    assert.equal(
      href('/blog/:category/:slug?', { category: 'remix', slug: 'rocks' }),
      '/blog/remix/rocks',
    );
    assert.equal(
      href('/blog/:category/:slug?', { category: 'remix', slug: ['rocks'] }),
      '/blog/remix/rocks',
    );
  });

  it('builds a href without optional pathname params', () => {
    type Routes = [PrefixRoute<'blog/:category', [Route<'edit'>, Route<':slug?'>]>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/blog/:category/:slug?', { category: 'remix' }), '/blog/remix');
  });

  it('allows passing an array of values for multiple params with the same name', () => {
    type Routes = [Route<'https://:id.remix.run/:id'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(
      href('https://:id.remix.run/:id', { id: ['www', 'rocks'] }),
      'https://www.remix.run/rocks',
    );
  });

  it('builds a href with arbitrary search params', () => {
    type Routes = [Route<'search'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/search', {}, { q: '' }), '/search?q');
    assert.equal(href('/search', {}, { q: 'remix' }), '/search?q=remix');
    assert.equal(href('/search', {}, { q: ['remix'] }), '/search?q=remix');
  });

  it('builds a href with required search params', () => {
    type Routes = [Route<'search?q'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/search?q', {}, { q: '' }), '/search?q');
    assert.equal(href('/search?q', {}, { q: 'remix' }), '/search?q=remix');
    assert.equal(href('/search?q', {}, { q: ['remix'] }), '/search?q=remix');
  });

  it('provides type hints for required search params that are missing/undefined', () => {
    type Routes = [Route<'search?q'>];
    let href = createHrefBuilder<Routes>();
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q', {}, {}), '/search?q');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q', {}, { q: undefined }), '/search?q=undefined');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q', {}, { q: [] }), '/search?q=undefined');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q', {}, { q: [undefined] }), '/search?q=undefined');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q', {}, { q: null }), '/search?q=null');
  });

  it('builds a href with required search params with a default value', () => {
    type Routes = [Route<'search?q=remix'>];
    let href = createHrefBuilder<Routes>();
    assert.equal(href('/search?q=remix', {}, {}), '/search?q=remix');
    assert.equal(href('/search?q=remix', {}, { q: 'remix' }), '/search?q=remix');
    assert.equal(href('/search?q=remix', {}, { q: ['remix'] }), '/search?q=remix');
  });

  it('provides type hints when a given search param does not match the default from the pattern', () => {
    type Routes = [Route<'search?q=remix'>];
    let href = createHrefBuilder<Routes>();
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q=remix', {}, { q: 'error' }), '/search?q=remix');
    // @ts-expect-error We're testing the error case
    assert.equal(href('/search?q=remix', {}, { q: ['error'] }), '/search?q=remix');
  });
});
