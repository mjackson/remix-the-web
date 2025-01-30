import { ParamsInit, Params } from './params.ts';

export type SearchParamsInit<T extends string = string> = ParamsInit<T>;

/**
 * An interface for accessing params found in the URL search/query string.
 *
 * Note: This is a read-only subset of the web's native [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) interface.
 */
export class SearchParams<T extends string = string> extends Params<T> {
  override get(name: T): string;
  override get(name: string): string | null;
  override get(name: string): string | null {
    for (let [n, value] of this) {
      if (n === name) return value;
    }

    return null;
  }

  override toString(): string {
    // @ts-expect-error URLSearchParams() in lib.dom is missing Iterable<[string, string]>
    let str = new URLSearchParams(this).toString();
    return str === '' ? '' : '?' + str;
  }
}

export type JoinSearchParams<A extends SearchParams, B extends SearchParams> = SearchParams<
  (A extends SearchParams<infer T> ? T : never) | (B extends SearchParams<infer T> ? T : never)
> & {};
