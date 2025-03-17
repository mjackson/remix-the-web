import type { RoutePattern } from './route-pattern.ts';

export interface RouteMatcher {
  /**
   * Matches a route pattern(s) against a URL and returns the match if successful, otherwise `null`.
   */
  (url: URL | string): RouteMatch | null;
}

type Params = Record<string, unknown>;

export class RouteMatch {
  /**
   * The pattern that matched the URL.
   */
  readonly pattern: RoutePattern;
  /**
   * The params extracted from the URL hostname/pathname.
   */
  readonly params: Params;
  /**
   * The params extracted from the URL search/query string.
   */
  readonly searchParams: Params;

  constructor(pattern: RoutePattern, params: Params, searchParams: Params) {
    this.pattern = pattern;
    this.params = params;
    this.searchParams = searchParams;
  }
}
