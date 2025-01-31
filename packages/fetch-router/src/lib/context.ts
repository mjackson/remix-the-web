export interface Context<T = unknown> {
  defaultValue?: T;
}

/**
 * Creates a context object that may be used to store and retrieve arbitrary values.
 *
 * If a `defaultValue` is provided, it will be returned from `context.get()` when no value has been
 * set for the context. Otherwise reading this context when no value has been set will throw an
 * error.
 *
 * @param defaultValue The default value for the context
 * @returns A context object
 */
export function createContext<T>(defaultValue?: T): Context<T> {
  return { defaultValue };
}

export type InitialContext = Map<Context, unknown>;

/**
 * Provides methods for writing/reading values in application context in a typesafe way.
 */
export class ContextProvider {
  #map = new Map<Context, unknown>();

  constructor(init?: InitialContext) {
    if (init) {
      for (let [context, value] of init) {
        this.set(context, value);
      }
    }
  }

  get<T>(context: Context<T>): T {
    if (this.#map.has(context)) {
      return this.#map.get(context) as T;
    }

    if (context.defaultValue !== undefined) {
      return context.defaultValue;
    }

    throw new Error('No value found for context');
  }

  set<C extends Context>(context: C, value: C extends Context<infer T> ? T : never): void {
    this.#map.set(context, value);
  }
}
