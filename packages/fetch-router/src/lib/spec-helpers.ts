export type Assert<T extends true> = T;

// Lifted from https://www.totaltypescript.com/how-to-test-your-types
export type Equal<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2 ? true : false;

export type Pretty<T> = { [K in keyof T]: T[K] } & unknown;
