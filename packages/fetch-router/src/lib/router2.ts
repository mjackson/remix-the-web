import { Middleware } from './middleware.ts';
import { Params, JoinParams } from './params.ts';
import { isRenderer, Renderer } from './renderer.ts';
import { RouteHandler } from './route-handler.ts';
import {
  JoinPatterns,
  RoutePattern,
  RoutePatternParams,
  RoutePatternSearchParams,
} from './route-pattern.ts';
import { SearchParams, JoinSearchParams } from './search-params.ts';

export type AnyRoute =
  | Route<any>
  | MiddlewareRoute<AnyRoute[]>
  | PrefixRoute<any, AnyRoute[]>
  | RendererRoute<AnyRoute[]>;

export interface Route<T extends string> {
  input: T;
  pattern: RoutePattern<T>;
  handler: RouteHandler<Params, Params, unknown>;
}

export interface MiddlewareRoute<C extends AnyRoute[]> {
  middleware: Middleware[];
  children: C;
}

export interface PrefixRoute<T extends string, C extends AnyRoute[]> {
  input: T;
  children: C;
}

export interface RendererRoute<C extends AnyRoute[]> {
  renderer: Renderer;
  children: C;
}

interface RouterCallback<R extends Router<Params, SearchParams, any>, C extends AnyRoute[]> {
  (router: R): C;
}

export class Router<
  P extends Params = Params<never, never>,
  S extends SearchParams = SearchParams<never>,
  R = BodyInit,
> {
  #pattern: RoutePattern<string>;

  constructor(pattern: string | RoutePattern<string> = '/') {
    this.#pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
    this.route = this.route.bind(this);
    this.mount = this.mount.bind(this);
    this.use = this.use.bind(this);
  }

  mount<T extends string, const C extends AnyRoute[]>(
    pattern: T | RoutePattern<T>,
    callback: RouterCallback<
      Router<
        JoinParams<P, RoutePatternParams<T>>,
        JoinSearchParams<S, RoutePatternSearchParams<T>>,
        R
      >,
      C
    >,
  ): PrefixRoute<T, C> {
    return {
      input: typeof pattern === 'string' ? pattern : pattern.source,
      children: callback(new Router(this.#pattern.join(pattern) as any)),
    };
  }

  route<T extends string>(
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<
      JoinParams<P, RoutePatternParams<T>>,
      JoinSearchParams<S, RoutePatternSearchParams<T>>,
      R
    >,
  ): Route<T> {
    return {
      input: typeof pattern === 'string' ? pattern : pattern.source,
      pattern: this.#pattern.join(pattern) as any,
      handler: handler as any,
    };
  }

  use<U, const C extends AnyRoute[]>(
    renderer: Renderer<U>,
    callback: RouterCallback<Router<P, S, U>, C>,
  ): RendererRoute<C>;
  use<const C extends AnyRoute[]>(
    middleware: Middleware<P, S, R> | Middleware<P, S, R>[],
    callback?: RouterCallback<Router<P, S, R>, C>,
  ): MiddlewareRoute<C>;
  use<const C extends AnyRoute[]>(
    arg: Renderer | Middleware<P, S, R> | Middleware<P, S, R>[],
    callback: RouterCallback<Router<P, S, any>, C>,
  ): RendererRoute<C> | MiddlewareRoute<C> {
    if (isRenderer(arg)) {
      return { renderer: arg, children: callback(this as any) };
    } else {
      return {
        middleware: (Array.isArray(arg) ? arg : [arg]) as any,
        children: callback?.(this as any) ?? ([] as any),
      };
    }
  }
}

export function createRoutes<const C extends AnyRoute[]>(callback?: RouterCallback<Router, C>): C {
  return callback?.(new Router()) ?? ([] as any);
}

import { createRenderer } from './renderer.ts';

let NumberRenderer = createRenderer(
  (value: number, init) =>
    new Response(value.toString(), {
      ...init,
      headers: {
        ...init?.headers,
        'Content-Type': 'text/plain',
      },
    }),
);

let routes = createRoutes(({ mount, route }) => [
  route('/', () => new Response('home')),
  route(':id', ({ params }) => new Response(`post ${params.get('id')}`)),
  mount('/site', ({ mount, route, use }) => [
    route('about', () => new Response('about')),
    mount('blog', ({ route }) => [
      route('edit', () => new Response('edit')),
      route(
        ':id?q',
        ({ params, searchParams }) =>
          new Response(`post ${params.get('id')} + ${searchParams.get('q')}`),
      ),
    ]),
    use(NumberRenderer, ({ route }) => [
      route('404', ({ render }) =>
        render(404, {
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

// prettier-ignore
type RoutePatterns<T extends AnyRoute[], P extends string = '/'> =
  T extends [infer L extends AnyRoute, ...infer R extends AnyRoute[]] ?
    R extends [] ? RoutePatterns_<L, P> :
    RoutePatterns_<L, P> | RoutePatterns<R, P> :
  never

// prettier-ignore
type RoutePatterns_<T extends AnyRoute, P extends string> =
  T extends Route<infer I> ? JoinPatterns<P, I> :
  T extends MiddlewareRoute<infer C> ? RoutePatterns<C, P> :
  T extends PrefixRoute<infer I, infer C> ? RoutePatterns<C, JoinPatterns<P, I>> :
  T extends RendererRoute<infer C> ? RoutePatterns<C, P> :
  never

export interface HrefBuilder<T extends string> {
  (input: T, params?: Params, searchParams?: SearchParams): string;
}

export function createHrefBuilder<T extends AnyRoute[]>(): HrefBuilder<RoutePatterns<T>> {
  return (input, params, searchParams) => input;
}

let href = createHrefBuilder<typeof routes>();
