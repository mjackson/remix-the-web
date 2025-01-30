import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assert, Equal } from '../../test/spec-helpers.ts';

import { createRoutes } from './router.ts';
import { matchRoutes } from './route-matching.ts';
import { Middleware } from './middleware.ts';

describe('matchRoutes', () => {
  it('matches a route', () => {
    let routes = createRoutes(({ route }) => [
      route('/hello', () => new Response('Hello, world!')),
    ]);

    let match = matchRoutes(routes, new URL('https://remix.run/hello'));

    assert.ok(match);
    assert.equal(match.route.pattern.source, '/hello');
  });

  it('matches all middleware that comes before a route', () => {
    let middleware1: Middleware = (_, next) => {
      return next();
    };
    let middleware2: Middleware = (_, next) => {
      return next();
    };

    let routes = createRoutes(({ use, route }) => [
      use(middleware1),
      route('/hello', () => new Response('Hello, world!')),
      use(middleware2),
    ]);

    let match = matchRoutes(routes, new URL('https://remix.run/hello'));

    assert.ok(match);
    assert.equal(match.middleware.length, 1);
    assert.equal(match.middleware[0], middleware1);
  });
});
