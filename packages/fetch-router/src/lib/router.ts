import { Middleware } from './middleware.js';
import { Params } from './params.js';
import { Renderer, DefaultRenderer } from './renderer.js';
import { RequestHandler } from './request-handler.js';
import {
  RoutePattern,
  RoutePatternParamName,
  RoutePatternSearchParamName,
  JoinPatterns,
  joinPatterns,
} from './route-pattern.js';
import { SearchParams } from './search-params.js';

type DefaultRendererValueType = typeof DefaultRenderer extends Renderer<infer T> ? T : never;

type AnyRoute = Route<any> | MiddlewareRoute<any> | PrefixRoute<any> | RendererRoute<any>;

interface Route<T extends string> {
  pattern: RoutePattern<T>;
  handler: RequestHandler<Params, SearchParams, unknown>;
}

interface MiddlewareRoute<T extends ReadonlyArray<AnyRoute>> {
  middleware: Middleware[];
  children: T;
}

interface PrefixRoute<T extends ReadonlyArray<AnyRoute>> {
  children: T;
}

interface RendererRoute<T extends ReadonlyArray<AnyRoute>> {
  renderer: Renderer;
  children: T;
}

type RouterParams<P extends Params, T extends string> = Params<
  P extends Params<infer U> ? U | RoutePatternParamName<T> : never
> & {};

type RouterSearchParams<S extends SearchParams, T extends string> = SearchParams<
  S extends SearchParams<infer U> ? U | RoutePatternSearchParamName<T> : never
> & {};

export class Router<
  P extends Params = Params<never>,
  S extends SearchParams = SearchParams<never>,
  R = DefaultRendererValueType,
  E extends string = '/',
> {
  protected paramsVarianceMarker!: P;

  protected searchParamsVarianceMarker!: S;

  #pattern: E;

  constructor(pattern?: E) {
    this.#pattern = pattern ?? ('/' as E);
    this.mount = this.mount.bind(this);
    this.route = this.route.bind(this);
    this.use = this.use.bind(this);
  }

  mount<A extends string, const C extends ReadonlyArray<AnyRoute>>(
    pattern: A,
    callback: (
      router: Router<RouterParams<P, A>, RouterSearchParams<S, A>, R, JoinPatterns<E, A>>,
    ) => C,
  ): PrefixRoute<C> {
    return {
      children: callback(new Router(joinPatterns(this.#pattern, pattern) as JoinPatterns<E, A>)),
    };
  }

  route<A extends string>(
    pattern: A,
    handler: RequestHandler<RouterParams<P, A>, RouterSearchParams<S, A>, R>,
  ): Route<JoinPatterns<E, A>> {
    return {
      pattern: new RoutePattern(joinPatterns(this.#pattern, pattern) as JoinPatterns<E, A>),
      handler,
    };
  }

  use<M extends Middleware<P, S>, const C extends ReadonlyArray<AnyRoute>>(
    middleware: M | M[],
    callback?: (router: Router<P, S, R, E>) => C,
  ): MiddlewareRoute<C>;
  use<T, const C extends ReadonlyArray<AnyRoute>>(
    renderer: Renderer<T>,
    callback: (router: Router<P, S, T, E>) => C,
  ): RendererRoute<C>;
  use<const C extends ReadonlyArray<AnyRoute>>(
    arg: Middleware | Middleware[] | Renderer,
    callback: (router: Router<P, S, any, E>) => C,
  ): MiddlewareRoute<C> | RendererRoute<C> {
    if (typeof arg === 'function' || Array.isArray(arg)) {
      return {
        middleware: Array.isArray(arg) ? arg : [arg],
        children: callback?.(this) ?? ([] as unknown as C),
      };
    } else {
      return {
        renderer: arg,
        children: callback(this as Router<P, S, any, E>),
      };
    }
  }
}

export function createRoutes<const C extends ReadonlyArray<AnyRoute>>(
  callback: (router: Router) => C,
): C {
  return callback(new Router());
}
