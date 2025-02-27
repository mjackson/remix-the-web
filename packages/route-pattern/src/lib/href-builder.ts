import type { RoutePattern } from './route-pattern.ts';

type HrefBuilderPattern<T extends RoutePattern> =
  T extends RoutePattern<infer P> ? PatternWithoutOptionals<P> : never;

// prettier-ignore
type PatternWithoutOptionals<T extends string> =
  T extends `${infer L}(${infer M})${infer R}` ?
    `${L}${PatternWithoutOptionals<R>}` | `${L}${M}${PatternWithoutOptionals<R>}` :
    T

type HrefBuilderParams<T extends string> = Record<string, unknown>; // TODO
type HrefBuilderSearchParams<T extends string> = Record<string, unknown>; // TODO

interface HrefBuilder<T extends string> {
  (pattern: T, params?: HrefBuilderParams<T>, searchParams?: HrefBuilderSearchParams<T>): string;
}

export function createHrefBuilder<T extends RoutePattern>(
  pattern?: T,
): HrefBuilder<HrefBuilderPattern<T>>;
export function createHrefBuilder<T extends ReadonlyArray<RoutePattern>>(
  patterns?: T,
): HrefBuilder<HrefBuilderPattern<T[number]>>;
export function createHrefBuilder(patterns: any): any {
  return (pattern: string, params?: any, searchParams?: any) => {
    return ''; // TODO
  };
}
