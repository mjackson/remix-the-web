import { create } from 'domain';
import { Params } from './params.js';
import { Renderer, DefaultRenderType } from './renderer.js';
import { RouteHandler } from './route-handler.js';
import { RoutePatternParamName, RoutePatternSearchParamName } from './route-pattern.js';
import { SearchParams } from './search-params.js';

interface Route<T extends string, R> {
  pattern: T;
  handler: RouteHandler<Params, SearchParams, R>;
}

type RouterParams<P extends Params, T extends string> = Params<
  P extends Params<infer U> ? U | RoutePatternParamName<T> : never
>;

type RouterSearchParams<S extends SearchParams, T extends string> = SearchParams<
  S extends SearchParams<infer U> ? U | RoutePatternSearchParamName<T> : never
>;

export interface Router<
  P extends Params = Params<never>,
  S extends SearchParams = SearchParams<never>,
  R = DefaultRenderType,
> {
  mount<T extends string>(
    pattern: T,
    callback: (router: Router<RouterParams<P, T>, RouterSearchParams<S, T>, R>) => void,
  ): void;

  render<T>(renderer: Renderer<T>, callback: (router: Router<P, S, T>) => void): void;

  route<T extends string>(
    pattern: T,
    handler: RouteHandler<RouterParams<P, T>, RouterSearchParams<S, T>, R>,
  ): void;
}
