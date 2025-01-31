import type {
  ExtractProtocol,
  ExtractHostname,
  ExtractPathname,
  ExtractSearch,
  JoinProtocol,
  JoinHostname,
  JoinPathname,
  JoinSearch,
} from './route-pattern-helpers.ts';
import {
  extractProtocol,
  extractHostname,
  extractPathname,
  extractSearch,
  joinProtocol,
  joinHostname,
  joinPathname,
  joinSearch,
} from './route-pattern-helpers.ts';

export interface RoutePattern {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
}

export function parse(pattern: string): RoutePattern {
  return {
    protocol: extractProtocol(pattern),
    hostname: extractHostname(pattern),
    pathname: extractPathname(pattern),
    search: extractSearch(pattern),
  };
}

// prettier-ignore
export type RoutePatternString<
  Protocol extends string,
  Hostname extends string,
  Pathname extends string,
  Search extends string,
> = Hostname extends '' ? `${Pathname}${Search}` :
    Protocol extends '' ? `://${Hostname}${Pathname}${Search}` :
    `${Protocol}//${Hostname}${Pathname}${Search}`

export function routePatternString(
  protocol: string,
  hostname: string,
  pathname: string,
  search: string,
): string {
  // prettier-ignore
  return (
    hostname === '' ? `${pathname}${search}` :
    protocol === '' ? `://${hostname}${pathname}${search}` :
    `${protocol}//${hostname}${pathname}${search}`
  );
}

export type RoutePatternJoin<E extends string, A extends string> = RoutePatternString<
  JoinProtocol<ExtractProtocol<E>, ExtractProtocol<A>>,
  JoinHostname<ExtractHostname<E>, ExtractHostname<A>>,
  JoinPathname<ExtractPathname<E>, ExtractPathname<A>>,
  JoinSearch<ExtractSearch<E>, ExtractSearch<A>>
>;

export function join(existing: string, additional: string): string {
  return routePatternString(
    joinProtocol(extractProtocol(existing), extractProtocol(additional)),
    joinHostname(extractHostname(existing), extractHostname(additional)),
    joinPathname(extractPathname(existing), extractPathname(additional)),
    joinSearch(extractSearch(existing), extractSearch(additional)),
  );
}
