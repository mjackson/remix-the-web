import { Middleware, NextFunction } from './middleware.js';
import { Params, JoinParams } from './params.js';
import { isRenderer, Renderer } from './renderer.js';
import { RouteHandler } from './route-handler.js';
import {
  JoinPatterns,
  RoutePattern,
  RoutePatternParams,
  RoutePatternSearchParams,
} from './route-pattern.js';
import { SearchParams, JoinSearchParams } from './search-params.js';

export type AnyRoute =
  | Route<any>
  | MiddlewareRoute<AnyRoute[]>
  | PrefixRoute<AnyRoute[]>
  | RendererRoute<AnyRoute[]>;

export interface Route<T extends string> {
  pattern: RoutePattern<T>;
  handler: RouteHandler<Params, SearchParams, unknown>;
}

export interface MiddlewareRoute<C extends AnyRoute[]> {
  middleware: Middleware[];
  children: C;
}

export interface PrefixRoute<C extends AnyRoute[]> {
  children: C;
}

export interface RendererRoute<C extends AnyRoute[]> {
  renderer: Renderer;
  children: C;
}

interface RouterCallback<R extends Router<any, any>, C extends AnyRoute[]> {
  (router: R): C;
}

export class Router<T extends string = '/', R = BodyInit> {
  #pattern: RoutePattern<T>;

  constructor(pattern: T | RoutePattern<T> = '/' as T) {
    this.#pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
    this.mount = this.mount.bind(this);
    this.route = this.route.bind(this);
    this.use = this.use.bind(this);
  }

  mount<A extends string, const C extends AnyRoute[]>(
    pattern: A | RoutePattern<A>,
    callback: RouterCallback<Router<JoinPatterns<T, A>, R>, C>,
  ): PrefixRoute<C> {
    return {
      children: callback(new Router(this.#pattern.join(pattern))),
    };
  }

  route<A extends string>(
    pattern: A | RoutePattern<A>,
    handler: RouteHandler<
      JoinParams<RoutePatternParams<T>, RoutePatternParams<A>>,
      JoinSearchParams<RoutePatternSearchParams<T>, RoutePatternSearchParams<A>>,
      R
    >,
  ): Route<JoinPatterns<T, A>> {
    return {
      pattern: this.#pattern.join(pattern),
      handler,
    };
  }

  use<U, const C extends AnyRoute[]>(
    renderer: Renderer<U>,
    callback: RouterCallback<Router<T, U>, C>,
  ): RendererRoute<C>;
  use<const C extends AnyRoute[]>(
    middleware:
      | Middleware<RoutePatternParams<T>, RoutePatternSearchParams<T>, R>
      | Middleware<RoutePatternParams<T>, RoutePatternSearchParams<T>, R>[],
    callback?: RouterCallback<Router<T, R>, C>,
  ): MiddlewareRoute<C>;
  use(
    arg: Renderer | Middleware<any, any, any> | Middleware<any, any, any>[],
    callback: RouterCallback<Router<T, R>, AnyRoute[]>,
  ): RendererRoute<AnyRoute[]> | MiddlewareRoute<AnyRoute[]> {
    if (isRenderer(arg)) {
      return { renderer: arg as any, children: callback(this) };
    } else {
      return {
        middleware: Array.isArray(arg) ? arg : [arg],
        children: callback?.(this) ?? ([] as any),
      };
    }
  }
}

export function createRoutes<const C extends AnyRoute[]>(callback?: RouterCallback<Router, C>): C {
  return callback?.(new Router()) ?? ([] as any);
}

import { createRenderer } from './renderer.js';

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

import { ParamsString, SearchParamsString } from './params-string.js';

export type RouterWithParams<
  P extends Params,
  S extends SearchParams = SearchParams,
  R = BodyInit,
> = Router<`${ParamsString<P>}${SearchParamsString<S>}`, R>;

function cartRoutes({ route }: RouterWithParams<Params<'cartId'>>): AnyRoute[] {
  return [
    route('checkout', ({ params }) => new Response('checkout')), // Route</anything/:cartId/checkout>
    route('items', () => new Response('items')),
  ];
}

let routes = createRoutes(({ mount, route }) => [
  route('/', () => new Response('home')),
  route(':id', ({ params }) => new Response(`post ${params.get('id')}`)),
  mount('cart/:cartId', cartRoutes),
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
type RoutePatterns<T extends AnyRoute[]> =
  T extends [infer L extends AnyRoute, ...infer R extends AnyRoute[]] ?
    R extends [] ? RoutePatterns_<L> :
    RoutePatterns_<L> | RoutePatterns<R> :
  never;

// prettier-ignore
type RoutePatterns_<T extends AnyRoute> =
  T extends Route<infer P> ? P :
  T extends ParentRoute<infer C> ? RoutePatterns<C> :
  never;

type ParentRoute<T extends AnyRoute[]> = MiddlewareRoute<T> | PrefixRoute<T> | RendererRoute<T>;

export interface HrefBuilder<T extends string> {
  (input: T, params?: Params, searchParams?: SearchParams): string;
}

export function createHrefBuilder<T extends AnyRoute[]>(): HrefBuilder<RoutePatterns<T>> {
  return (input, params, searchParams) => input;
}

let href = createHrefBuilder<typeof routes>();

import { InitialContext, ContextProvider } from './context.js';
import { RequestEnv } from './request-env.js';

export interface RequestHandlerOptions {
  initialContext?: InitialContext;
}

export interface RequestHandler {
  (request: Request, options?: RequestHandlerOptions): Response | Promise<Response>;
}

export interface CreateRequestHandlerOptions {
  dev?: boolean;
  onError?: (error: Error) => void;
}

export function createRequestHandler(
  routes: AnyRoute[],
  options?: CreateRequestHandlerOptions,
): RequestHandler {
  let dev = options?.dev ?? false;
  let matcher = new RouteMatcher(routes);

  return async (request, options) => {
    let match = matcher.match(request);

    if (match) {
      let context = new ContextProvider(options?.initialContext);
      let env: RequestEnv = {
        context,
        params: match.params,
        render: match.renderer.render,
        request,
        searchParams: match.searchParams,
      };

      let response =
        match.middleware.length > 0
          ? await runMiddleware(match.middleware, env, async () => {
              return await match.route.handler(env);
            })
          : await match.route.handler(env);

      return response;
    }

    return new Response('Not found', { status: 404 });
  };
}

async function runMiddleware(
  middleware: Middleware[],
  env: RequestEnv,
  next: NextFunction,
  index = 0,
): Promise<Response> {
  let downstreamResponse: Response | undefined;
  let nextMiddleware: NextFunction = async () => {
    // Guard against middleware calling next() multiple times
    if (downstreamResponse) return downstreamResponse;

    downstreamResponse =
      index === middleware.length - 1
        ? await next()
        : await runMiddleware(middleware, env, next, index + 1);

    return downstreamResponse;
  };

  let response: Response | void;
  try {
    let mid = middleware[index];
    response = await mid(env, nextMiddleware);
  } catch (error) {
    if (error instanceof Response) {
      // Allow a Response to be thrown from inside middleware, but return it
      // normally so that upstream middleware can still operate on it.
      return error;
    } else {
      throw error;
    }
  }

  if (!response) {
    // If next() was called, reuse the response we already got from going
    // downstream. Otherwise, automatically go downstream to get a response.
    response = downstreamResponse ?? (await nextMiddleware());
  }

  return response;
}

export interface RouteMatch {
  middleware: Middleware[];
  renderer: Renderer;
  route: Route<string>;
  params: Params;
  searchParams: SearchParams;
}

export class RouteMatcher {
  #routes: AnyRoute[];

  constructor(routes: AnyRoute[]) {
    this.#routes = routes;
  }

  match(request: Request): RouteMatch | null {
    return null;
  }
}
