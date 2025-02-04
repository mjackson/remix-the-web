import type { Middleware } from './middleware.ts';
import type { Params } from './params.ts';
import type { Renderer } from './renderer.ts';
import type { RouteHandler } from './route-handler.ts';
import type { RoutePatternParams, RoutePatternSearchParams } from './route-pattern-params.ts';
import type { SearchParams } from './search-params.ts';
import type { RoutePattern, RoutePatternJoin } from './route-pattern2.ts';
import { parse } from './route-pattern2.ts';

export type AnyRoute =
  | MiddlewareRoute<AnyRoute[]>
  | PrefixRoute<AnyRoute[]>
  | RenderRoute<AnyRoute[]>
  | Route<any>;

export interface MiddlewareRoute<T extends AnyRoute[]> {
  middleware: Middleware[];
  children: T;
}

export interface PrefixRoute<T extends AnyRoute[]> {
  children: T;
}

export interface RenderRoute<T extends AnyRoute[]> {
  renderer: Renderer;
  children: T;
}

export interface Route<T extends string> {
  pattern: T;
  handler: RouteHandler<RoutePatternParams<T>, RoutePatternSearchParams<T>, unknown>;
}

export interface Router<T extends string = '/', R = BodyInit> {
  mount<A extends string, const C extends AnyRoute[]>(
    pattern: A,
    callback: RouterCallback<Router<RoutePatternJoin<T, A>, R>, C>,
  ): PrefixRoute<C>;

  render<U, const C extends AnyRoute[]>(
    renderer: Renderer<U>,
    callback: RouterCallback<Router<T, U>, C>,
  ): RenderRoute<C>;

  route<A extends string>(
    pattern: A,
    handler: RouteHandler<
      JoinParams<RoutePatternParams<T>, RoutePatternParams<A>>,
      JoinSearchParams<RoutePatternSearchParams<T>, RoutePatternSearchParams<A>>,
      R
    >,
  ): Route<RoutePatternJoin<T, A>>;

  use<const C extends AnyRoute[]>(
    middleware: Middleware | Middleware[],
    callback?: RouterCallback<Router<T, R>, C>,
  ): MiddlewareRoute<C>;
}

interface RouterCallback<R extends Router<any, any>, T extends AnyRoute[]> {
  (router: R): T;
}

type JoinParams<A extends Params, B extends Params> = Params<
  (A extends Params<infer T> ? T : never) | (B extends Params<infer T> ? T : never)
> & {};

type JoinSearchParams<A extends SearchParams, B extends SearchParams> = SearchParams<
  (A extends SearchParams<infer T> ? T : never) | (B extends SearchParams<infer T> ? T : never)
> & {};

let patternStack: RoutePattern[] = [
  {
    protocol: '',
    hostname: '',
    pathname: '/',
    search: '',
  },
];

function pushPattern<T>(pattern: string, callback: () => T): T {
  patternStack.push(parse(pattern));
  let result = callback();
  patternStack.pop();
  return result;
}

function mount<const C extends AnyRoute[]>(
  pattern: string,
  callback: RouterCallback<Router, C>,
): PrefixRoute<C> {
  return { children: callback(new Router(pattern)) };
}

function route<T extends string>(pattern: T, handler: RouteHandler): Route<T> {
  return { pattern, handler };
}

export function createRoutes<const C extends AnyRoute[]>(
  callback?: RouterCallback<Router<'/', BodyInit>, C>,
): C {
  // return callback?.(new Router()) ?? ([] as any);
  return [] as unknown as C;
}

// prettier-ignore
type RoutePatterns<T extends AnyRoute[]> =
  T extends [infer L extends AnyRoute, ...infer R extends AnyRoute[]] ?
    RoutePatterns_<L> | RoutePatterns<R> :
  never;

// prettier-ignore
type RoutePatterns_<T extends AnyRoute> =
  T extends Route<infer P> ? P :
  T extends ParentRoute<infer C> ? RoutePatterns<C> :
  never;

type ParentRoute<T extends AnyRoute[]> = MiddlewareRoute<T> | PrefixRoute<T> | RenderRoute<T>;

export interface HrefBuilder<T extends string> {
  (input: T, params?: Params, searchParams?: SearchParams): string;
}

export function createHrefBuilder<T extends AnyRoute[]>(): HrefBuilder<RoutePatterns<T>> {
  return (input, params, searchParams) => input;
}

// app code

const NumberRenderer: Renderer<number> = (value: number, init) =>
  new Response(value.toString(), {
    ...init,
    headers: {
      ...init?.headers,
      'Content-Type': 'text/plain',
    },
  });

let routes = createRoutes(({ mount, route }) => [
  route('/', () => new Response('home')),
  route(':id', ({ params }) => new Response(`post ${params.get('id')}`)),
  mount('/site', ({ mount, render, route }) => [
    route('about', () => new Response('about')),
    mount('blog', ({ route }) => [
      route('edit', () => new Response('edit')),
      route(
        ':id?q',
        ({ params, searchParams }) =>
          new Response(`post ${params.get('id')} + ${searchParams.get('q')}`),
      ),
    ]),
    render(NumberRenderer, ({ route }) => [
      route('404', ({ respond }) =>
        respond(404, {
          headers: { 'X-Test': 'true' },
        }),
      ),
    ]),
    route('blog', () => new Response('blog')),
    route('contact', () => new Response('contact')),
    mount('/', ({ route }) => [
      route('home', () => new Response('home')),
      route('search', () => new Response('search')),
    ]),
  ]),
]);

let href = createHrefBuilder<typeof routes>();
