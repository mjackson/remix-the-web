export type ParamsInit<T extends string = string> =
  | [T, string][]
  | Iterable<[T, string]>
  | Record<T, string | string[]>;

/**
 * An interface for accessing params found in the URL hostname and/or pathname.
 *
 * Note: This is a read-only subset of the web's native [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) interface.
 */
export class Params<T extends string = string> implements Iterable<[string, string]> {
  protected varianceMarker!: { [K in T]: string };

  #pairs: Array<readonly [string, string]>;

  constructor(init?: ParamsInit<T>) {
    this.#pairs = [];

    if (init != null) {
      if (Array.isArray(init) || isIterable(init)) {
        for (let [name, value] of init) {
          this.#append(name, value);
        }
      } else {
        for (let name in init) {
          let value = init[name];
          if (Array.isArray(value)) {
            value.forEach((v) => this.#append(name, v));
          } else {
            this.#append(name, value);
          }
        }
      }
    }
  }

  #append(name: string, value: string): void {
    this.#pairs.push([name, value]);
  }

  has<N extends string extends T ? never : T>(name: N): true;
  has(name: string): boolean;
  has(name: string): boolean {
    for (let [n] of this.#pairs) {
      if (n === name) return true;
    }

    return false as any;
  }

  get<N extends string extends T ? never : T>(name: N): string;
  get(name: string): string | null;
  get(name: string): string | null {
    for (let i = this.#pairs.length - 1; i >= 0; --i) {
      let [n, value] = this.#pairs[i];
      if (n === name) return value;
    }

    return null as any;
  }

  getAll(name: string): string[] {
    let values = [];

    for (let [n, value] of this.#pairs) {
      if (n === name) values.push(value);
    }

    return values;
  }

  forEach<T>(fn: (this: T, name: string, value: string, params: this) => void, thisArg?: T): void {
    this.#pairs.forEach(([name, value]) => fn.call((thisArg || this) as T, name, value, this));
  }

  keys(): IterableIterator<string> {
    return this.#pairs.map(([name]) => name)[Symbol.iterator]();
  }

  values(): IterableIterator<string> {
    return this.#pairs.map(([, value]) => value)[Symbol.iterator]();
  }

  entries(): IterableIterator<[string, string]> {
    return this.#pairs.map(([name, value]) => [name, value] as [string, string])[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  toString(): string {
    let kv = this.#pairs.map(([name, value]) => `${name}=${value}`);
    return `[${this.constructor.name} ${kv.join(', ')}]`;
  }

  toJSON(): [string, string][] {
    return Array.from(this);
  }
}

function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return (
    typeof obj === 'object' &&
    obj != null &&
    Symbol.iterator in obj &&
    typeof obj[Symbol.iterator] === 'function'
  );
}
