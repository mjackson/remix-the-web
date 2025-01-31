import { type Env } from './env.ts';
import { Params } from './params.ts';
import { SearchParams } from './search-params.ts';

/**
 * A function that handles a request and may either 1) return a response or 2) call the `next`
 * function to pass control to the next middleware or route handler in the chain.
 */
export interface Middleware<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = BodyInit,
> {
  (env: Env<P, S, R>, next: NextFunction): void | Response | Promise<void | Response>;
}

export interface NextFunction {
  (): Response | Promise<Response>;
}
