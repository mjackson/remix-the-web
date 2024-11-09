import { Params } from './params.js';
import { DefaultRendererValueType } from './renderer.js';
import { RequestEnv } from './request-env.js';
import { SearchParams } from './search-params.js';

/**
 * A function that handles a request to a specific route.
 */
export interface RouteHandler<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = DefaultRendererValueType,
> {
  (env: RequestEnv<P, S, R>): Response | Promise<Response>;
}
