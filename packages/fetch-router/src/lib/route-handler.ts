import { ContextProvider } from './context.js';
import { RoutePatternMatch } from './route-pattern.js';

export interface RouteArg<P extends string> {
  context: ContextProvider;
  match: RoutePatternMatch<P>;
  request: Request;
}

/**
 * A function that handles a request to a specific route.
 *
 * This function typically returns a Response, but may also return some other type when the route
 * uses a custom renderer.
 */
export interface RouteHandler<P extends string, T> {
  (arg: RouteArg<P>): T | Promise<T>;
}
