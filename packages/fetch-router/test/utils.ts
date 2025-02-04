import * as assert from 'node:assert/strict';

export function assertNotNull<T>(
  value: T,
  message?: string | Error,
): asserts value is Exclude<T, null> {
  assert.notEqual(value, null, message);
}

export function assertNotUndefined<T>(
  value: T,
  message?: string | Error,
): asserts value is Exclude<T, undefined> {
  assert.notEqual(value, undefined, message);
}

export type Assert<T extends true> = T;

export type Refute<T extends false> = T;

// Lifted from https://www.totaltypescript.com/how-to-test-your-types
export type Equal<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;

export type Extends<Actual, Expected> = Actual extends Expected ? true : false;

export type Pretty<T> = { [K in keyof T]: T[K] } & unknown;
