// import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.ts';
import { Params } from './params.ts';
import { createRenderer } from './renderer.ts';
import { RouteHandler } from './route-handler.ts';
import { Router, createRoutes } from './router.ts';
import { SearchParams } from './search-params.ts';

const NumberRenderer = createRenderer((value: number, init) => {
  let body = value.toString();
  return new Response(body, {
    ...init,
    headers: {
      ...init?.headers,
      'Content-Length': String(body.length),
      'Content-Type': 'text/plain',
    },
  });
});

// prettier-ignore
type RouterVarianceSpec = [
  Assert<Equal<Router<Params<'a'>> extends Router<Params<'a'>> ? true : false, true>>,
  Assert<Equal<Router<Params<'a'>, SearchParams> extends Router<Params<'a'>, SearchParams> ? true : false, true>>,

  Assert<Equal<Router<Params, SearchParams<'q'>> extends Router<Params, SearchParams<'q'>> ? true : false, true>>,
  Assert<Equal<Router<Params, SearchParams<'a' | 'q'>> extends Router<Params, SearchParams<'q'>> ? true : false, true>>,

  Assert<Equal<Router<Params<'a' | 'b'>> extends Router<Params<'a'>> ? true : false, true>>,
  Assert<Equal<Router<Params<'a' | 'b'>, SearchParams> extends Router<Params<'a'>, SearchParams> ? true : false, true>>,

  Assert<Equal<Router<Params<'a' | 'b'>, SearchParams<'q'>> extends Router<Params<'a'>, SearchParams<'q'>> ? true : false, true>>,
  Assert<Equal<Router<Params<'a' | 'b'>, SearchParams<'a' | 'q'>> extends Router<Params<'a'>, SearchParams<'q'>> ? true : false, true>>,

  Assert<Equal<Router<Params<'a'>> extends Router<Params<'b'>> ? true : false, false>>,
  Assert<Equal<Router<Params<'a'>, SearchParams> extends Router<Params<'b'>, SearchParams> ? true : false, false>>,
];

describe('middleware', () => {
  it('has the correct params type', () => {
    createRoutes(({ mount }) => [
      mount('/:name', ({ use }) => [
        use(({ params }) => {
          type T = Assert<Equal<typeof params, Params<'name'>>>;
          return new Response(`Hello, ${params.get('name')}!`);
        }),
      ]),
    ]);
  });

  it('has the correct searchParams type', () => {
    createRoutes(({ mount }) => [
      mount('?q', ({ use }) => [
        use(({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
          return new Response(`Results for ${searchParams.get('q')}`);
        }),
      ]),
    ]);
  });
});

describe('request handler', () => {
  it('has the correct params type', () => {
    createRoutes(({ route }) => [
      route('/hello/:name', ({ params }) => {
        type T = Assert<Equal<typeof params, Params<'name'>>>;
        return new Response(`Hello, ${params.get('name')}!`);
      }),
    ]);
  });

  it('has the correct params type inside a prefix route', () => {
    createRoutes(({ mount }) => [
      mount('/:user', ({ route }) => [
        route('/:id', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<'user' | 'id'>>>;
          return new Response(`Hello, ${params.get('user')}!`);
        }),
      ]),
    ]);
  });

  it('has the correct searchParams type', () => {
    createRoutes(({ route }) => [
      route('/search?q', ({ searchParams }) => {
        type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
        return new Response(`Results for ${searchParams.get('q')}`);
      }),
    ]);
  });

  it('has the correct searchParams type inside a prefix route', () => {
    createRoutes(({ mount }) => [
      mount('?s', ({ route }) => [
        route('?q', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<'s' | 'q'>>>;
          return new Response(`Results for ${searchParams.get('q')}`);
        }),
      ]),
    ]);
  });

  it('returns a response by default', () => {
    createRoutes(({ route }) => [route('/', () => new Response('Hello, world!'))]);
  });

  it('renders a number when using a custom renderer', () => {
    let handler: RouteHandler<Params, SearchParams, number> = ({ render }) => render(123);

    // prettier-ignore
    createRoutes(({ use }) => [
      use(NumberRenderer, ({ route }) => [
        route('/', handler)
      ])
    ]);
  });
});
