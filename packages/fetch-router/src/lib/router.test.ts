import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal } from '../../test/utils.ts';

import { type Params } from './params.ts';
import { type Renderer } from './renderer.ts';
import { createRoutes } from './router.ts';
import { type SearchParams } from './search-params.ts';

describe('createRoutes', () => {
  describe('type inference in a route handler callback', () => {
    it('uses the correct type for params', () => {
      let routes0 = createRoutes(({ route }) => [
        route('/', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<never, never>>>;
          return new Response();
        }),
      ]);

      let routes1 = createRoutes(({ route }) => [
        route(':id', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<'id', never>>>;
          return new Response();
        }),
      ]);

      let routes2 = createRoutes(({ route }) => [
        route('/:id', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<'id', never>>>;
          return new Response();
        }),
      ]);

      let routes3 = createRoutes(({ route }) => [
        route('/:id?', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<never, 'id'>>>;
          return new Response();
        }),
      ]);

      let routes4 = createRoutes(({ route }) => [
        route('/:id?q', ({ params }) => {
          type T = Assert<Equal<typeof params, Params<'id', never>>>;
          return new Response();
        }),
      ]);
    });

    it('uses the correct type for searchParams', () => {
      let routes0 = createRoutes(({ route }) => [
        route('/', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
          return new Response();
        }),
      ]);

      let routes1 = createRoutes(({ route }) => [
        route(':id', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
          return new Response();
        }),
      ]);

      let routes2 = createRoutes(({ route }) => [
        route('/:id', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
          return new Response();
        }),
      ]);

      let routes3 = createRoutes(({ route }) => [
        route('/:id?', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
          return new Response();
        }),
      ]);

      let routes4 = createRoutes(({ route }) => [
        route('/:id?q', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
          return new Response();
        }),
      ]);

      let routes5 = createRoutes(({ route }) => [
        route('?', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
          return new Response();
        }),
      ]);

      let routes6 = createRoutes(({ route }) => [
        route('?q', ({ searchParams }) => {
          type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
          return new Response();
        }),
      ]);
    });

    it('uses the correct type for respond value', () => {
      let routes = createRoutes(({ route }) => [
        route('/', ({ respond }) => {
          type T = Assert<Equal<Parameters<typeof respond>[0], BodyInit>>;
          return respond('home');
        }),
      ]);
    });
  });

  describe('type inference in a route handler callback under a prefix route', () => {
    it('uses the correct type for params', () => {
      let routes0 = createRoutes(({ mount }) => [
        mount('/', ({ route }) => [
          route('/', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<never, never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes1 = createRoutes(({ mount }) => [
        mount('/:id', ({ route }) => [
          route('/', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes2 = createRoutes(({ mount }) => [
        mount('/blog', ({ route }) => [
          route(':id', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes3 = createRoutes(({ mount }) => [
        mount('/blog/:id', ({ route }) => [
          route('/', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes4 = createRoutes(({ mount }) => [
        mount('/blog/:id?', ({ route }) => [
          route('/', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<never, 'id'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes5 = createRoutes(({ mount }) => [
        mount('/blog/:id?q', ({ route }) => [
          route('/', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes6 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route(':id', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'section' | 'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes7 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route('/:id', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'section' | 'id', never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes8 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route(':id?', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'section', 'id'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes9 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route('/:id?q', ({ params }) => {
            type T = Assert<Equal<typeof params, Params<'section' | 'id', never>>>;
            return new Response();
          }),
        ]),
      ]);
    });

    it('uses the correct type for searchParams', () => {
      let routes0 = createRoutes(({ mount }) => [
        mount('/', ({ route }) => [
          route('/', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes1 = createRoutes(({ mount }) => [
        mount('/:id', ({ route }) => [
          route('/', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes2 = createRoutes(({ mount }) => [
        mount('?q', ({ route }) => [
          route(':id', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes3 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route('?q', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes4 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route(':id', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<never>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes5 = createRoutes(({ mount }) => [
        mount('/:section', ({ route }) => [
          route(':id?q', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes6 = createRoutes(({ mount }) => [
        mount('/', ({ route }) => [
          route('?q&a', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q' | 'a'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes7 = createRoutes(({ mount }) => [
        mount('/', ({ route }) => [
          route('?q=&a', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q' | 'a'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes8 = createRoutes(({ mount }) => [
        mount('/?q', ({ route }) => [
          route('?a=', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q' | 'a'>>>;
            return new Response();
          }),
        ]),
      ]);

      let routes9 = createRoutes(({ mount }) => [
        mount('/', ({ route }) => [
          route('?q=&a=1', ({ searchParams }) => {
            type T = Assert<Equal<typeof searchParams, SearchParams<'q' | 'a'>>>;
            return new Response();
          }),
        ]),
      ]);
    });
  });

  describe('type inference in a route handler callback under a render route', () => {
    it('uses the correct type for respond', () => {
      let NumberRenderer: Renderer<number> = (value, init) =>
        new Response(value.toString(), {
          ...init,
          headers: {
            ...init?.headers,
            'Content-Type': 'text/plain',
          },
        });

      let routes = createRoutes(({ render }) => [
        render(NumberRenderer, ({ route }) => [
          route('/', ({ respond }) => {
            type T = Assert<Equal<Parameters<typeof respond>[0], number>>;
            return respond(200);
          }),
        ]),
      ]);
    });
  });
});
