import { Middleware } from './middleware.js';
import { Params } from './params.js';
import { Renderer, DefaultRenderer, createRenderer } from './renderer.js';
import { RouteHandler } from './route-handler.js';
import {
  RoutePattern,
  RoutePatternParamName,
  RoutePatternSearchParamName,
  joinPatterns,
} from './route-pattern.js';
import { SearchParams } from './search-params.js';

type DefaultRendererValueType = typeof DefaultRenderer extends Renderer<infer T> ? T : never;

export type AnyRoute =
  | Route<string>
  | MiddlewareRoute<any>
  | PrefixRoute<string, any>
  | RendererRoute<any>;

export interface Route<T extends string> {
  input: T;
  pattern: RoutePattern<string>;
  handler: RouteHandler<Params, SearchParams, unknown>;
}

export interface MiddlewareRoute<C extends ReadonlyArray<AnyRoute>> {
  middleware: Middleware[];
  children: C;
}

export interface PrefixRoute<T extends string, C extends ReadonlyArray<AnyRoute>> {
  input: T;
  children: C;
}

export interface RendererRoute<C extends ReadonlyArray<AnyRoute>> {
  renderer: Renderer;
  children: C;
}

type JoinParams<P extends Params, T extends string> = Params<
  P extends Params<infer U> ? U | RoutePatternParamName<T> : never
> & {};

type JoinSearchParams<S extends SearchParams, T extends string> = SearchParams<
  S extends SearchParams<infer U> ? U | RoutePatternSearchParamName<T> : never
> & {};

export interface RouterCallback<
  R extends Router<Params, SearchParams, any>,
  C extends ReadonlyArray<AnyRoute>,
> {
  (router: R): C;
}

export class Router<
  P extends Params = Params<never>,
  S extends SearchParams = SearchParams<never>,
  R = DefaultRendererValueType,
> {
  protected paramsVarianceMarker!: P;
  protected searchParamsVarianceMarker!: S;

  #pattern: string;

  constructor(pattern = '/') {
    this.#pattern = pattern;
    this.mount = this.mount.bind(this);
    this.route = this.route.bind(this);
    this.use = this.use.bind(this);
  }

  route<T extends string>(
    pattern: T | RoutePattern<T>,
    handler: RouteHandler<JoinParams<P, T>, JoinSearchParams<S, T>, R>,
  ): Route<T> {
    if (pattern instanceof RoutePattern) {
      let input = pattern.source;
      return {
        input,
        pattern: new RoutePattern(joinPatterns(this.#pattern, input), {
          ignoreCase: pattern.ignoreCase,
        }),
        handler,
      };
    } else {
      return {
        input: pattern,
        pattern: new RoutePattern(joinPatterns(this.#pattern, pattern)),
        handler,
      };
    }
  }

  mount<T extends string, const C extends ReadonlyArray<AnyRoute>>(
    pattern: T | RoutePattern<T>,
    callback: RouterCallback<Router<JoinParams<P, T>, JoinSearchParams<S, T>, R>, C>,
  ): PrefixRoute<T, C> {
    if (pattern instanceof RoutePattern) {
      return {
        input: pattern.source,
        children: callback(new Router(joinPatterns(this.#pattern, pattern.source))),
      };
    } else {
      return {
        input: pattern,
        children: callback(new Router(joinPatterns(this.#pattern, pattern))),
      };
    }
  }

  use<M extends Middleware<P, S, R>, const C extends ReadonlyArray<AnyRoute>>(
    middleware: M | M[],
    callback?: RouterCallback<Router<P, S, R>, C>,
  ): MiddlewareRoute<C>;
  use<T, const C extends ReadonlyArray<AnyRoute>>(
    renderer: Renderer<T>,
    callback: RouterCallback<Router<P, S, T>, C>,
  ): RendererRoute<C>;
  use<const C extends ReadonlyArray<AnyRoute>>(
    arg: Middleware | Middleware[] | Renderer,
    callback: RouterCallback<Router<P, S, any>, C>,
  ): MiddlewareRoute<C> | RendererRoute<C> {
    if (typeof arg === 'function' || Array.isArray(arg)) {
      return {
        middleware: Array.isArray(arg) ? arg : [arg],
        children: callback?.(this) ?? ([] as unknown as C),
      };
    } else {
      return {
        renderer: arg,
        children: callback(this as Router<P, S, any>),
      };
    }
  }
}

export function createRoutes<const C extends ReadonlyArray<AnyRoute>>(
  callback: RouterCallback<Router, C>,
): C {
  return callback(new Router());
}
