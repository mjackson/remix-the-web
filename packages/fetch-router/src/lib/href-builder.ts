import { AnyRoute, Route, MiddlewareRoute, PrefixRoute, RendererRoute } from './router.js';
import {
  RoutePattern,
  ExtractHostname,
  ExtractPathname,
  ExtractSearch,
  JoinPatterns,
} from './route-pattern.js';
import {
  HostnameParamName,
  PathnameParamName,
  OptionalHostnameParamName,
  OptionalPathnameParamName,
} from './route-pattern-helpers.js';

// prettier-ignore
export type RoutePatterns<T extends ReadonlyArray<AnyRoute>, B extends string = '/'> =
  T extends [infer L extends AnyRoute, ...infer R extends ReadonlyArray<AnyRoute>] ?
    R extends [] ? RoutePatterns_<L, B> :
    RoutePatterns_<L, B> | RoutePatterns<R, B> :
  never

// prettier-ignore
type RoutePatterns_<T extends AnyRoute, B extends string> =
  T extends Route<infer I> ? JoinPatterns<B, I> :
  T extends MiddlewareRoute<infer C> ? RoutePatterns<C, B> :
  T extends PrefixRoute<infer I, infer C> ? RoutePatterns<C, JoinPatterns<B, I>> :
  T extends RendererRoute<infer C> ? RoutePatterns<C, B> :
  never

// prettier-ignore
export type HrefBuilderParams<T extends string> =
	Record<HostnameParamName<ExtractHostname<T>> | PathnameParamName<ExtractPathname<T>>, string | [string, ...string[]]> &
	Partial<Record<OptionalHostnameParamName<ExtractHostname<T>> | OptionalPathnameParamName<ExtractPathname<T>>, string | string[]>>

// prettier-ignore
export type HrefBuilderSearchParams<T extends string> =
	RequiredSearchParams<ExtractSearch<T>> &
	AnySearchParams // Allow additional arbitrary search params

// prettier-ignore
type RequiredSearchParams<T extends string> =
  T extends `?${infer R}` ? RequiredSearchParams<R> :
  T extends `` ? AnySearchParams :
  T extends `${infer L}&${infer R}` ? RequiredSearchParams<L> & RequiredSearchParams<R> :
  T extends `${infer L}=${infer R}` ?
    L extends `` ? AnySearchParams :
    Partial<Record<L, R | [R, ...R[]]>> : // ?q=remix, any provided value must match the default given in the pattern
  Record<T, string | [string, ...string[]]> // ?q, any provided value is acceptable

type AnySearchParams = Record<string, string | string[]>;

export interface HrefBuilder<T extends string> {
  (input: T, params?: HrefBuilderParams<T>, searchParams?: HrefBuilderSearchParams<T>): string;
}

/**
 * Creates a function that builds links (<a href> values) for a given set of routes.
 */
export function createHrefBuilder<T extends ReadonlyArray<AnyRoute>>(): HrefBuilder<
  RoutePatterns<T>
> {
  return function buildHref(input, params, searchParams) {
    let pattern = RoutePattern.parse(input);

    let href = '';

    if (pattern.protocol) {
      href += `${pattern.protocol.replace(/\?/g, '')}//`;
    } else if (pattern.hostname) {
      // If there's a hostname we also need a protocol. Since SSL is encouraged for everyone
      // and doesn't have any negative performance side effects, https: is a good default.
      href += 'https://';
    }

    let paramsValues: Record<string, (string | undefined)[]> = {};
    for (let key in params) {
      let value = (params as Record<string, string | string[] | undefined>)[key];
      paramsValues[key] = Array.isArray(value) ? value.slice(0) : [value];
    }

    if (pattern.hostname) {
      href += pattern.hostname
        .split('.')
        .map((part) => {
          if (part.startsWith(':')) {
            let name = part.endsWith('?') ? part.slice(1, -1) : part.slice(1);

            if (name in paramsValues) {
              return String(paramsValues[name].shift());
            } else if (part.endsWith('?')) {
              // Omit optional hostname params that are not provided
              return null;
            } else {
              return 'undefined';
            }
          }

          return part;
        })
        .filter((part) => part !== null)
        .join('.');
    }

    if (pattern.pathname) {
      href += pattern.pathname
        .split('/')
        .map((part) => {
          if (part.startsWith(':')) {
            let name = part.endsWith('?') ? part.slice(1, -1) : part.slice(1);

            if (name in paramsValues) {
              return String(paramsValues[name].shift());
            } else if (part.endsWith('?')) {
              // Omit optional pathname params that are not provided
              return null;
            } else {
              return 'undefined';
            }
          }

          return part;
        })
        .filter((part) => part !== null)
        .join('/');
    }

    // Start with the search params from the pattern
    let hrefSearchParams = new URLSearchParams(pattern.search);

    for (let key in searchParams) {
      if (hrefSearchParams.get(key)) {
        continue; // Default value was provided in the pattern, do not override it
      }

      let value = searchParams[key];

      if (Array.isArray(value)) {
        hrefSearchParams.delete(key);

        if (value.length > 0) {
          for (let v of value) {
            hrefSearchParams.append(key, v);
          }
        } else {
          hrefSearchParams.set(key, 'undefined');
        }
      } else {
        hrefSearchParams.set(key, value);
      }
    }

    href += hrefSearchParams.toString();

    return href;
  };
}
