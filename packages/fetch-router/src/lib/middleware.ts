import { Params } from './params.ts';
import { DefaultRendererValueType } from './renderer.ts';
import { RequestEnv } from './request-env.ts';
import { SearchParams } from './search-params.ts';

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
