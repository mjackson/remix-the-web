import { ContextProvider } from './context.ts';
import { Params } from './params.ts';
import { SearchParams } from './search-params.ts';

export interface Env<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = unknown,
> {
  /**
   * Context that is shared by all middleware and the route handler in the current
   * request/response cycle.
   */
  context: ContextProvider;
  /**
   * URL hostname and pathname parameters that were matched by the current route pattern.
   */
  params: P;
  /**
   * URL search/query parameters that were matched by the current route pattern.
   */
  searchParams: S;
  /**
   * A function that is used to generate the response for the current route.
   */
  respond: (value: R, init?: ResponseInit) => Response | Promise<Response>;
  /**
   * The current request object.
   */
  request: Request;
}
