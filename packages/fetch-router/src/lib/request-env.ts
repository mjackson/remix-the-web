import { ContextProvider } from './context.js';
import { Params } from './params.js';
import { SearchParams } from './search-params.js';
import { Renderer, DefaultRendererValueType } from './renderer.js';

type RenderFunction<T> = Renderer<T>['render'];

export interface RequestEnv<
  P extends Params = Params,
  S extends SearchParams = SearchParams,
  R = DefaultRendererValueType,
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
   * A custom render function that is used to render the response for the current route.
   */
  render: RenderFunction<R>;
  /**
   * The current request object.
   */
  request: Request;
}
