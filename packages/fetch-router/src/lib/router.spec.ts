// import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.js';
import { createRoutes, route, use } from './router.js';

import { Params } from './params.js';
import { Renderer } from './renderer.js';
import { SearchParams } from './search-params.js';

const TextRenderer: Renderer<string> = {
  render(value) {
    return new Response(value, {
      headers: {
        'Content-Length': String(value.length),
        'Content-Type': 'text/plain',
      },
    });
  },
};

describe('route handler', () => {
  it('has the correct params type', () => {
    createRoutes([
      route('/hello/:name', ({ params }) => {
        type T = Assert<Equal<typeof params, Params<'name', never>>>;
        return new Response(`Hello, ${params.get('name')}!`);
      }),
    ]);
  });

  it.todo('has the correct params type inside a prefix route');

  it('has the correct searchParams type', () => {
    createRoutes([
      route('/search?q', ({ searchParams }) => {
        type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
        return new Response(`Results for ${searchParams.get('q')}`);
      }),
    ]);
  });

  it.todo('has the correct searchParams type inside a prefix route');

  it('returns a response by default', () => {
    createRoutes([route('/', () => new Response('Hello, world!'))]);
  });

  it('returns a string when using a string renderer', () => {
    createRoutes([use(TextRenderer, [route('/', () => 'Hello, world!')])]);
  });
});
