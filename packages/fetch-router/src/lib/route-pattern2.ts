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

export interface RoutePattern<T extends string = string> {
  protocol: string extends T ? string : ExtractProtocol<T>;
  hostname: string extends T ? string : ExtractHostname<T>;
  pathname: string extends T ? string : ExtractPathname<T>;
  search: string extends T ? string : ExtractSearch<T>;
}

export function parse(pattern: string): RoutePattern {
  return {
    protocol: extractProtocol(pattern),
    hostname: extractHostname(pattern),
    pathname: extractPathname(pattern),
    search: extractSearch(pattern),
  };
}

export type RoutePatternJoin<A extends string, B extends string> = RoutePatternString<{
  protocol: JoinProtocol<ExtractProtocol<A>, ExtractProtocol<B>>;
  hostname: JoinHostname<ExtractHostname<A>, ExtractHostname<B>>;
  pathname: JoinPathname<ExtractPathname<A>, ExtractPathname<B>>;
  search: JoinSearch<ExtractSearch<A>, ExtractSearch<B>>;
}>;

export function join(a: string, b: string): string {
  return stringify({
    protocol: joinProtocol(extractProtocol(a), extractProtocol(b)),
    hostname: joinHostname(extractHostname(a), extractHostname(b)),
    pathname: joinPathname(extractPathname(a), extractPathname(b)),
    search: joinSearch(extractSearch(a), extractSearch(b)),
  });
}

// prettier-ignore
export type RoutePatternString<T extends RoutePattern> =
  T['hostname'] extends '' ? `${T['pathname']}${T['search']}` :
  T['protocol'] extends '' ? `://${T['hostname']}${T['pathname']}${T['search']}` :
  `${T['protocol']}//${T['hostname']}${T['pathname']}${T['search']}`;

export function stringify(pattern: RoutePattern): string {
  // prettier-ignore
  return pattern.hostname === '' ? `${pattern.pathname}${pattern.search}` :
    pattern.protocol === '' ? `://${pattern.hostname}${pattern.pathname}${pattern.search}` :
    `${pattern.protocol}//${pattern.hostname}${pattern.pathname}${pattern.search}`;
}
