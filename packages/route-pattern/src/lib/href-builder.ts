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

export function createHrefBuilder<T extends RoutePattern, P extends HrefBuilderPattern<T>>(
  pattern: P,
  params?: HrefBuilderParams<P>,
  searchParams?: HrefBuilderSearchParams<P>,
): string {
  return ''; // TODO
}
