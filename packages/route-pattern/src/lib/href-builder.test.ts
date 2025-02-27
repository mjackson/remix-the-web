import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal } from '../../test/utils.ts';

import { RoutePattern } from './route-pattern.ts';
import { createHrefBuilder } from './href-builder.ts';

describe('createHrefBuilder', () => {
  describe('with a single pattern', () => {
    it('provides type hints for the pattern arg', () => {
      let pattern = new RoutePattern('/users(/:id)');
      let href = createHrefBuilder(pattern);

      type T = Assert<Equal<Parameters<typeof href>[0], '/users' | '/users/:id'>>;
    });
  });

  describe('with multiple patterns', () => {
    it('provides type hints for the pattern arg', () => {
      let patterns = [new RoutePattern('/users(/:id)'), new RoutePattern('/blog(/:slug)')] as const;
      let href = createHrefBuilder(patterns);

      type T = Assert<
        Equal<Parameters<typeof href>[0], '/users' | '/users/:id' | '/blog' | '/blog/:slug'>
      >;
    });

    it('provides type hints for the pattern arg when the generic is explicitly provided', () => {
      let patterns = [
        new RoutePattern('/users(/:id)'),
        new RoutePattern('http(s)://remix.run/blog(/:slug)'),
      ] as const;
      let href = createHrefBuilder<typeof patterns>();

      type T = Assert<
        Equal<
          Parameters<typeof href>[0],
          | '/users'
          | '/users/:id'
          | 'http://remix.run/blog'
          | 'http://remix.run/blog/:slug'
          | 'https://remix.run/blog'
          | 'https://remix.run/blog/:slug'
        >
      >;
    });
  });
});
