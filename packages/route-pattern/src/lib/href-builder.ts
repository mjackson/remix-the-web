import type { RoutePattern } from './route-pattern.ts';

// prettier-ignore
type HrefBuilderPattern<T extends RoutePattern> =
  T extends RoutePattern<infer P> ?
    ExpandOptionals<P> extends infer U ?
      U extends string ? { source: P; output: U } : never :
      never :
    never;

// prettier-ignore
type ExpandOptionals<T extends string> =
  T extends `${infer L}(${infer M})${infer R}` ?
    `${L}${ExpandOptionals<R>}` | `${L}${M}${ExpandOptionals<R>}` :
    T;

type HrefBuilderParams<T extends RoutePattern> = Record<string, T['source']>; // TODO
type HrefBuilderSearchParams<T extends RoutePattern> = Record<string, unknown>; // TODO

interface HrefBuilder<T extends RoutePattern> {
  <P extends HrefBuilderPattern<T>>(
    pattern: P['output'],
    params?: HrefBuilderParams<Extract<T, { source: P['source'] }>>,
    searchParams?: HrefBuilderSearchParams<Extract<T, { source: P['source'] }>>,
  ): string;
}

export function createHrefBuilder<T extends RoutePattern>(pattern?: T): HrefBuilder<T>;
export function createHrefBuilder<T extends ReadonlyArray<RoutePattern>>(
  patterns?: T,
): HrefBuilder<T[number]>;
export function createHrefBuilder(patterns: any): any {
  return (pattern: string, params?: any, searchParams?: any) => {
    return ''; // TODO
  };
}
