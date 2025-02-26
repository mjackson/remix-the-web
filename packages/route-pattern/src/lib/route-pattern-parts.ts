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

export interface RoutePatternParts {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
}

export type SplitRoutePatternParts<T extends string> = {
  protocol: ExtractProtocol<T>;
  hostname: ExtractHostname<T>;
  pathname: ExtractPathname<T>;
  search: ExtractSearch<T>;
};

export function splitRoutePatternParts(pattern: string): RoutePatternParts {
  return {
    protocol: extractProtocol(pattern),
    hostname: extractHostname(pattern),
    pathname: extractPathname(pattern),
    search: extractSearch(pattern),
  };
}

// prettier-ignore
export type JoinRoutePatternParts<T extends RoutePatternParts> =
  T['hostname'] extends '' ? `${T['pathname']}${T['search']}` :
  T['protocol'] extends '' ? `://${T['hostname']}${T['pathname']}${T['search']}` :
  `${T['protocol']}//${T['hostname']}${T['pathname']}${T['search']}`;

export function joinRoutePatternParts({
  protocol,
  hostname,
  pathname,
  search,
}: RoutePatternParts): string {
  // prettier-ignore
  return (
    hostname === '' ? `${pathname}${search}` :
    protocol === '' ? `://${hostname}${pathname}${search}` :
    `${protocol}//${hostname}${pathname}${search}`
  );
}

export type JoinRoutePatterns<A extends string, B extends string> = JoinRoutePatternParts<{
  protocol: JoinProtocol<ExtractProtocol<A>, ExtractProtocol<B>>;
  hostname: JoinHostname<ExtractHostname<A>, ExtractHostname<B>>;
  pathname: JoinPathname<ExtractPathname<A>, ExtractPathname<B>>;
  search: JoinSearch<ExtractSearch<A>, ExtractSearch<B>>;
}>;

export function joinRoutePatterns(a: string, b: string): string {
  return joinRoutePatternParts({
    protocol: joinProtocol(extractProtocol(a), extractProtocol(b)),
    hostname: joinHostname(extractHostname(a), extractHostname(b)),
    pathname: joinPathname(extractPathname(a), extractPathname(b)),
    search: joinSearch(extractSearch(a), extractSearch(b)),
  });
}
