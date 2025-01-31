import { type Env } from './env.ts';
import { Params } from './params.ts';
import { SearchParams } from './search-params.ts';

/**
 * A function that handles a request to a specific route.
 */
export interface RouteHandler<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = BodyInit,
> {
  (env: Env<P, S, R>): Response | Promise<Response>;
}
