import { Params } from './params.ts';
import { DefaultRendererValueType } from './renderer.ts';
import { RequestEnv } from './request-env.ts';
import { SearchParams } from './search-params.ts';

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
