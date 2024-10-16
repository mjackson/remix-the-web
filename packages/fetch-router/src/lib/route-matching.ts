import { Object } from 'ts-toolbelt';

import { Middleware } from './middleware.js';
import { Renderer, DefaultRenderer } from './renderer.js';
import { AnyRoute, MiddlewareRoute, RenderRoute, Route } from './router.js';
import { RoutePatternMatch } from './route-pattern.js';

export interface RouteMatch<T> {
  match: RoutePatternMatch<any>;
  middleware: Middleware<any>[];
  renderer: Renderer<T>;
  route: Route<any, T>;
}

export function matchRoutes<T>(routes: AnyRoute<T>[], url: URL): RouteMatch<T> | null {
  let match = matchRoutes_(routes, url);

  if (match == null) {
    return null;
  }

  if (match.renderer == null) {
    match.renderer = DefaultRenderer as Renderer<T>;
  }

  return match as RouteMatch<T>;
}

function matchRoutes_<T>(
  routes: AnyRoute<T>[],
  url: URL,
): Object.Optional<RouteMatch<T>, 'renderer'> | null {
  let middleware: Middleware<any>[] = [];

  for (let route of routes) {
    if (hasPattern(route)) {
      let match = route.pattern.match(url);

      if (match != null) {
        return {
          match,
          middleware,
          route,
        };
      }
    } else if (hasChildren(route)) {
      let match = matchRoutes_(route.children, url);

      if (match != null) {
        if (isMiddlewareRoute(route)) {
          match.middleware.unshift(...route.middleware);
        }

        if (middleware.length > 0) {
          match.middleware.unshift(...middleware);
        }

        if (isRenderRoute(route) && match.renderer == null) {
          match.renderer = route.renderer;
        }

        return match;
      }
    } else if (isMiddlewareRoute(route)) {
      // Middleware routes with no children simply add their middleware to the stack
      middleware.push(...route.middleware);
    }
  }

  return null;
}

function hasChildren<T>(route: AnyRoute<T>): route is AnyRoute<T> & { children: AnyRoute<T>[] } {
  return 'children' in route && route.children != null;
}

function hasPattern<T>(route: AnyRoute<T>): route is Route<any, T> {
  return 'pattern' in route;
}

function isMiddlewareRoute<T>(route: AnyRoute<T>): route is MiddlewareRoute<any, T> {
  return 'middleware' in route;
}

function isRenderRoute<T>(route: AnyRoute<T>): route is RenderRoute<T> {
  return 'renderer' in route;
}
