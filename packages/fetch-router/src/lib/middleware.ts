import { Params } from './params.js';
import { DefaultRendererValueType } from './renderer.js';
import { RequestEnv } from './request-env.js';
import { SearchParams } from './search-params.js';

/**
 * A function that handles a request and may either 1) return a response or 2) call the `next`
 * function to pass control to the next middleware or route handler in the chain.
 */
export interface Middleware<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = DefaultRendererValueType,
> {
  (env: RequestEnv<P, S, R>, next: NextFunction): void | Response | Promise<void | Response>;
}

export interface NextFunction {
  (): Response | Promise<Response>;
}
