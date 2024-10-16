import { ContextProvider } from './context.js';
import { Params } from './params.js';
import { DefaultRenderType } from './renderer.js';
import { SearchParams } from './search-params.js';

export interface RouteArg<P extends Params, S extends SearchParams> {
  context: ContextProvider;
  params: P;
  searchParams: S;
  request: Request;
}

/**
 * A function that handles a request to a specific route.
 *
 * This function typically returns a `Response`, but may also return some other type when the route
 * uses a custom renderer.
 */
export interface RouteHandler<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = DefaultRenderType,
> {
  (arg: RouteArg<P, S>): R | Promise<R>;
}
