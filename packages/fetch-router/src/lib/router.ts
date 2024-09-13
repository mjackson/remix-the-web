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

export class RoutePattern<T extends string> {
  readonly source: T;

  constructor(source: T) {
    this.source = source;
  }

  match(url: URL): RouteMatch<T> | null {
    let params = new Params();
    let searchParams = new SearchParams();
    return {
      params,
      searchParams,
    };
  }

  test(url: URL): boolean {
    return this.match(url) !== null;
  }

  toString(): string {
    return this.source;
  }
}

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
  | MiddlewareRoute<T>
  | PrefixRoute<string, T>
  | RenderRoute<any>
  | Route<string, T>;

export interface Route<P extends string, T> {
  pattern: P;
  handler: RouteHandler<P, T>;
}

export function route<P extends string, T>(
  pattern: P,
  handler: RouteHandler<P, T> | DynamicImport<RouteHandler<P, T>>,
): Route<P, T> {
  return {
    pattern,
    handler:
      typeof handler === 'function'
        ? handler
        : async function (match) {
            let resolved = await resolveDynamicImport(handler);
            return resolved(match);
          },
  };
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
  routes: AnyRoute<T>[];
}

export interface PrefixRoute<P extends string, T> {
  pattern: P;
  routes: AnyRoute<T>[];
}

export interface RenderRoute<T> {
  renderer: Renderer<T>;
  routes: AnyRoute<T>[];
}

export function use<T, const R extends AnyRoute<T>[]>(
  middleware: Middleware | Middleware[],
  routes?: R,
): MiddlewareRoute<T>;
export function use<P extends string, T, const R extends AnyRoute<T>[]>(
  pattern: P,
  routes: R,
): PrefixRoute<P, T>;
export function use<T, const R extends AnyRoute<T>[]>(
  renderer: Renderer<T>,
  routes: R,
): RenderRoute<T>;
export function use(arg: Middleware | Middleware[] | string | Renderer<any>, routes?: any) {
  if (typeof arg === 'function') {
    return { middleware: [arg], routes };
  } else if (Array.isArray(arg)) {
    return { middleware: arg, routes };
  } else if (typeof arg === 'string') {
    return { pattern: arg, routes };
  } else {
    return { renderer: arg, routes };
  }
}
