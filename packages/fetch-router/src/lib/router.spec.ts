// import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import { Params } from './params.js';
import { createRenderer } from './renderer.js';
import { createRoutes } from './router.js';
import { SearchParams } from './search-params.js';

const TextRenderer = createRenderer((value: string) => {
  return new Response(value, {
    headers: {
      'Content-Length': String(value.length),
      'Content-Type': 'text/plain',
    },
  });
});

describe('middleware', () => {
  it('has the correct match.params type', () => {
    createRoutes(({ mount }) => [
      mount('/:name', ({ use }) => [
        use(({ match }) => {
          type T = Assert<Equal<typeof match.params, Params<'name'>>>;
          return new Response(`Hello, ${match.params.get('name')}!`);
        }),
      ]),
    ]);
  });

  it('has the correct match.searchParams type', () => {
    createRoutes(({ mount }) => [
      mount('?q', ({ use }) => [
        use(({ match }) => {
          type T = Assert<Equal<typeof match.searchParams, SearchParams<'q'>>>;
          return new Response(`Results for ${match.searchParams.get('q')}`);
        }),
      ]),
    ]);
  });
});

describe('route handler', () => {
  it('has the correct match.params type', () => {
    createRoutes(({ route }) => [
      route('/hello/:name', ({ match }) => {
        type T = Assert<Equal<typeof match.params, Params<'name'>>>;
        return new Response(`Hello, ${match.params.get('name')}!`);
      }),
    ]);
  });

  it('has the correct params type inside a prefix route', () => {
    createRoutes(({ mount }) => [
      mount('/:user', ({ route }) => [
        route('/:id', ({ match }) => {
          type T = Assert<Equal<typeof match.params, Params<'user' | 'id'>>>;
          return new Response(`Hello, ${match.params.get('user')}!`);
        }),
      ]),
    ]);
  });

  it('has the correct match.searchParams type', () => {
    createRoutes(({ route }) => [
      route('/search?q', ({ match }) => {
        type T = Assert<Equal<typeof match.searchParams, SearchParams<'q'>>>;
        return new Response(`Results for ${match.searchParams.get('q')}`);
      }),
    ]);
  });

  it('has the correct searchParams type inside a prefix route', () => {
    createRoutes(({ mount }) => [
      mount('?s', ({ route }) => [
        route('?q', ({ match }) => {
          type T = Assert<Equal<typeof match.searchParams, SearchParams<'s' | 'q'>>>;
          return new Response(`Results for ${match.searchParams.get('q')}`);
        }),
      ]),
    ]);
  });

  it('returns a response by default', () => {
    createRoutes(({ route }) => [route('/', () => new Response('Hello, world!'))]);
  });

  it('returns a string when using a string renderer', () => {
    createRoutes(({ render }) => [
      render(TextRenderer, ({ route }) => [route('/', () => 'Hello, world!')]),
    ]);
  });
});
