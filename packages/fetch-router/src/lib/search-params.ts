import { ParamsInit, Params } from './params.js';
import { SearchParamName } from './params-helpers.js';

export type SearchParamsInit<T extends string = string> = ParamsInit<T>;

/**
 * An interface for accessing params found in the URL search/query string.
 *
 * Note: This is a read-only subset of the web's native [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) interface.
 */
export class SearchParams<T extends string = never> extends Params<T> {
  static fromSearch<T extends string>(search: T): SearchParams<SearchParamName<T>> {
    return new SearchParams(new URLSearchParams(search)) as SearchParams<SearchParamName<T>>;
  }

  override get(name: T): string;
  override get(name: string): string | null;
  override get(name: string): string | null {
    for (let [n, value] of this.pairs) {
      if (n === name) return value;
    }

    return null;
  }

  override toString(): string {
    // @ts-expect-error URLSearchParams() in lib.dom is missing Iterable<[string, string]>
    return new URLSearchParams(this).toString();
  }
}
