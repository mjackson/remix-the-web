import { Params } from './params.js';
import { RouteArg } from './route-handler.js';
import { SearchParams } from './search-params.js';

/**
 * A function that handles a request and may either 1) return a response or 2) call the `next`
 * function to pass control to the next middleware or route handler in the chain.
 */
export interface Middleware<P extends Params = Params, S extends SearchParams = SearchParams> {
  (arg: RouteArg<P, S>, next: NextFunction): void | Response | Promise<void | Response>;
}

export interface NextFunction {
  (): Response | Promise<Response>;
}
