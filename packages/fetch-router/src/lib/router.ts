import { DynamicImport, resolveDynamicImport } from './dynamic-import.js';
import { Params } from './params.js';
import {
  RequiredHostnameParamName,
  OptionalHostnameParamName,
  RequiredPathnameParamName,
  OptionalPathnameParamName,
  SearchParamName,
} from './params-helpers.js';
import { ExtractHostname, ExtractPathname, ExtractSearch } from './route-pattern-helpers.js';
import { SearchParams } from './search-params.js';

export interface RouteMatch<T extends string> {
  params: Params<
    RequiredHostnameParamName<ExtractHostname<T>> | RequiredPathnameParamName<ExtractPathname<T>>,
    OptionalHostnameParamName<ExtractHostname<T>> | OptionalPathnameParamName<ExtractPathname<T>>
  >;

  searchParams: SearchParams<SearchParamName<ExtractSearch<T>>>;
}

export interface RouteHandler<T extends string, R = Response> {
  (match: RouteMatch<T>): R | Promise<R>;
}

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

export interface Route<T extends string, R = Response> {
  pattern: RoutePattern<T>;
  handler: RouteHandler<T, R>;
}

export function createRoute<T extends string, R>(
  pattern: RoutePattern<T> | T,
  handler: RouteHandler<T, R> | DynamicImport<RouteHandler<T, R>>,
): Route<T, R> {
  return {
    pattern: typeof pattern === 'string' ? new RoutePattern(pattern) : pattern,
    handler:
      typeof handler === 'function'
        ? handler
        : async function (match) {
            let resolvedHandler = await resolveDynamicImport(handler);
            return resolvedHandler(match);
          },
  };
}
