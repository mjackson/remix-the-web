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

/**
 * Provides methods for writing/reading values to/from application context in a typesafe way.
 */
export class ContextProvider {
  #map = new Map<Context<any>, any>();

  set<C extends Context>(context: C, value: C extends Context<infer T> ? T : never): void {
    this.#map.set(context, value);
  }

  get<T>(context: Context<T>): T {
    if (this.#map.has(context)) {
      return this.#map.get(context);
    }

    if (context.defaultValue !== undefined) {
      return context.defaultValue;
    }

    throw new Error('No value found for context');
  }
}
