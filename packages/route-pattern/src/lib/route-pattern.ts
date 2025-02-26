import type { ParamCodecs, ParamCodec } from './param-codecs.ts';
import type { RoutePatternParams, RoutePatternSearchParams } from './route-pattern-params.ts';
import { joinRoutePatterns } from './route-pattern-parts.ts';

export interface RoutePatternOptions {
  ignoreCase?: boolean;
  params?: ParamCodecs;
  searchParams?: ParamCodecs;
}

/**
 * A RoutePattern is used to match URLs.
 */
export class RoutePattern<
  P extends string = string,
  O extends RoutePatternOptions = RoutePatternOptions,
> {
  readonly ignoreCase: boolean;
  readonly paramsCodecs: ParamCodecs;
  readonly searchParamsCodecs: ParamCodecs;
  readonly source: string;

  constructor(source: P, options?: O) {
    this.ignoreCase = options?.ignoreCase ?? false;
    this.paramsCodecs = options?.params ?? {};
    this.searchParamsCodecs = options?.searchParams ?? {};
    this.source = source;
  }

  /**
   * Joins this pattern with another.
   * @param pattern The pattern to join with this pattern
   * @returns A new pattern that is the result of joining this pattern with the given pattern
   */
  join(pattern: string | RoutePattern): RoutePattern {
    let options =
      pattern instanceof RoutePattern
        ? {
            ignoreCase: this.ignoreCase || pattern.ignoreCase,
            paramsCodecs: { ...this.paramsCodecs, ...pattern.paramsCodecs },
            searchParamsCodecs: { ...this.searchParamsCodecs, ...pattern.searchParamsCodecs },
          }
        : {
            ignoreCase: this.ignoreCase,
            paramsCodecs: this.paramsCodecs,
            searchParamsCodecs: this.searchParamsCodecs,
          };

    return new RoutePattern(
      joinRoutePatterns(this.source, typeof pattern === 'string' ? pattern : pattern.source),
      options,
    );
  }

  /**
   * Matches this pattern against the given URL.
   * @param url The URL to match against
   * @returns A `RoutePatternMatch` object if the URL matches this pattern, otherwise `null`
   */
  match(
    url: URL | string,
  ): RoutePatternMatch<
    RoutePatternParamsFromOptions<P, O>,
    RoutePatternSearchParamsFromOptions<P, O>
  > | null {
    if (typeof url === 'string') url = new URL(url);

    return { params: {}, searchParams: {} } as any; // TODO
  }

  /**
   * Tests if this pattern matches the given URL.
   * @param url The URL to test against
   * @returns `true` if this pattern matches the given URL, otherwise `false`
   */
  test(url: URL | string): boolean {
    return this.match(url) !== null;
  }

  /**
   * Returns a URL string of this pattern with interpolated params.
   * @param params The params to interpolate into the URL hostname and/or pathname
   * @param searchParams The params to interpolate into the URL search string
   * @returns A URL string
   */
  format(
    params?: RoutePatternParamsFromOptions<P, O>,
    searchParams?: RoutePatternSearchParamsFromOptions<P, O>,
  ): string {
    return ''; // TODO
  }

  toString() {
    return this.source;
  }
}

type RoutePatternParamsFromOptions<
  Pattern extends string,
  Options extends RoutePatternOptions,
> = RoutePatternParams<
  Pattern,
  Options extends { params: ParamCodecs } ? ParamCodecsTypes<Options['params']> : {}
>;

type RoutePatternSearchParamsFromOptions<
  Pattern extends string,
  Options extends RoutePatternOptions,
> = RoutePatternSearchParams<
  Pattern,
  Options extends { searchParams: ParamCodecs } ? ParamCodecsTypes<Options['searchParams']> : {}
>;

type ParamCodecsTypes<T extends ParamCodecs> = {
  [K in keyof T]: T[K] extends ParamCodec<infer U> ? U : never;
};

////////////////////////////////////////////////////////////////////////////////////////////////////

type Params = Record<string, unknown>;

/**
 * Contains information about the params and searchParams that were found in the URL.
 */
export class RoutePatternMatch<P extends Params = Params, S extends Params = Params> {
  /**
   * The matched params found in the URL hostname and pathname.
   */
  params: P;
  /**
   * The matched search params found in the URL search/query string.
   */
  searchParams: S;

  constructor(params: P, searchParams: S) {
    this.params = params;
    this.searchParams = searchParams;
  }
}
