import { DynamicImport, resolveDynamicImport } from './dynamic-import.js';
import { Middleware } from './middleware.js';
import { Params } from './params.js';
import {
  RequiredHostnameParamName,
  OptionalHostnameParamName,
  RequiredPathnameParamName,
  OptionalPathnameParamName,
  SearchParamName,
} from './params-helpers.js';
import { Renderer } from './renderer.js';
import { ExtractHostname, ExtractPathname, ExtractSearch } from './pattern-helpers.js';
import { SearchParams } from './search-params.js';

export interface RouteMatch<P extends string> {
  params: Params<
    RequiredHostnameParamName<ExtractHostname<P>> | RequiredPathnameParamName<ExtractPathname<P>>,
    OptionalHostnameParamName<ExtractHostname<P>> | OptionalPathnameParamName<ExtractPathname<P>>
  >;

  searchParams: SearchParams<SearchParamName<ExtractSearch<P>>>;
}

export interface RouteHandler<P extends string, R> {
  (match: RouteMatch<P>): R | Promise<R>;
}

export function createRoutes<const R extends AnyRoute<Response>[]>(routes: R): R {
  return routes;
}

export type AnyRoute<T> =
  | Route<string, T>
  | PrefixRoute<string, T>
  | MiddlewareRoute<T>
  | RenderRoute<any>;

export interface Route<P extends string, T> {
  pattern: P;
  handler: RouteHandler<P, T>;
}

export interface PrefixRoute<P extends string, T> {
  pattern: P;
  routes: AnyRoute<T>[];
}

export function route<P extends string, T>(
  pattern: P,
  handler: RouteHandler<P, T> | DynamicImport<RouteHandler<P, T>>,
): Route<P, T>;
export function route<P extends string, T, const R extends AnyRoute<T>[]>(
  pattern: P,
  routes: R,
): PrefixRoute<P, T>;
export function route<P extends string, T>(
  pattern: P,
  arg: RouteHandler<P, T> | DynamicImport<RouteHandler<P, T>> | AnyRoute<T>[],
): Route<P, T> | PrefixRoute<P, T> {
  if (Array.isArray(arg)) {
    return { pattern, routes: arg };
  } else if (typeof arg === 'function') {
    return { pattern, handler: arg };
  } else {
    return {
      pattern,
      async handler(match) {
        let resolved = await resolveDynamicImport(arg);
        return resolved(match);
      },
    };
  }
}

export function lazy<P extends string, T>(
  pattern: P,
  handler: () => DynamicImport<RouteHandler<P, T>>,
): Route<P, T> {
  return {
    pattern,
    async handler(match) {
      let resolved = await resolveDynamicImport(handler());
      return resolved(match);
    },
  };
}

export interface MiddlewareRoute<T> {
  middleware: Middleware[];
  routes?: AnyRoute<T>[];
}

export interface RenderRoute<T> {
  renderer: Renderer<T>;
  routes: AnyRoute<T>[];
}

export function use<T, const R extends AnyRoute<T>[]>(
  middleware: Middleware | Middleware[],
  routes?: R,
): MiddlewareRoute<T>;
export function use<T, const R extends AnyRoute<T>[]>(
  renderer: Renderer<T>,
  routes: R,
): RenderRoute<T>;
export function use<T>(
  arg: Middleware | Middleware[] | Renderer<T>,
  routes: AnyRoute<T>[],
): MiddlewareRoute<T> | RenderRoute<T> {
  if (typeof arg === 'function') {
    return { middleware: [arg], routes };
  } else if (Array.isArray(arg)) {
    return { middleware: arg, routes };
  } else {
    return { renderer: arg, routes };
  }
}
