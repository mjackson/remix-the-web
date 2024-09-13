import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRoutes, route, use } from './router.js';

import { staticMiddleware } from './static-middleware.js';
import { Renderer } from './renderer.js';

const StringRenderer: Renderer<string> = {
  render(value) {
    return new Response(value);
  },
};

describe('route handler', () => {
  it.todo('has the correct params type');

  it.todo('has the correct params type inside a prefix route');

  it.todo('has the correct searchParams type');

  it.todo('has the correct searchParams type inside a prefix route');
});

let routes = createRoutes([
  use(staticMiddleware('public')),
  route('/', () => new Response('Hello, world!')),
  route('/hello/:name', ({ params }) => new Response(`Hello, ${params.get('name')}!`)),
  use(StringRenderer, [
    route('/react', () => 'react'),
    route('/vue', () => new Response('vue')),
    route('/svelte', () => 'svelte'),
  ]),
]);

let stringRoutes = createRoutes([
  use(StringRenderer, [
    route('/', () => 'home'),
    route('/about', () => 'about'),
    route('/contact', () => 'contact'),
  ]),
  route('/profile', () => new Response('profile')),
]);
