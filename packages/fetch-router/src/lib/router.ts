import { DynamicImport, resolveDynamicImport } from './dynamic-import.js';
import { Middleware } from './middleware.js';
import { Renderer } from './renderer.js';
import { RouteHandler, RouteArg } from './route-handler.js';
import { JoinPatterns, joinPatterns } from './route-pattern.js';

export type AnyRoute<T> =
  | Route<any, T>
  | PrefixRoute<T>
  | MiddlewareRoute<any, T>
  | RenderRoute<any>;

export interface Route<P extends string, T> {
  pattern: P;
  handler: RouteHandler<P, T>;
}

export interface PrefixRoute<T> {
  routes: AnyRoute<T>[];
}

export interface MiddlewareRoute<P extends string, T> {
  middleware: Middleware<P>[];
  routes?: AnyRoute<T>[];
}

export interface RenderRoute<T> {
  renderer: Renderer<T>;
  routes: AnyRoute<T>[];
}

export interface Router<E extends string, T> {
  lazy<A extends string>(
    pattern: A,
    handler: () => DynamicImport<RouteHandler<JoinPatterns<E, A>, T>>,
  ): Route<JoinPatterns<E, A>, T>;

  mount<A extends string>(
    pattern: A,
    callback: (router: Router<JoinPatterns<E, A>, T>) => AnyRoute<T>[],
  ): PrefixRoute<T>;

  render<T>(
    renderer: Renderer<T>,
    callback: (router: Router<E, T>) => AnyRoute<T>[],
  ): RenderRoute<T>;

  route<A extends string>(
    pattern: A,
    handler:
      | RouteHandler<JoinPatterns<E, A>, T>
      | DynamicImport<RouteHandler<JoinPatterns<E, A>, T>>,
  ): Route<JoinPatterns<E, A>, T>;

  use(
    middleware: Middleware<E> | Middleware<E>[],
    callback?: (router: Router<E, T>) => AnyRoute<T>[],
  ): MiddlewareRoute<E, T>;
}

export function createRouter<P extends string = '/', T = Response>(pattern?: P): Router<P, T> {
  let basePattern = pattern ?? '/';

  function lazy(pattern: string, handler: any) {
    return {
      pattern: joinPatterns(basePattern, pattern),
      async handler(arg: RouteArg<any>) {
        let resolved = (await resolveDynamicImport(handler())) as RouteHandler<any, T>;
        return resolved(arg);
      },
    };
  }

  function mount(pattern: string, callback: any) {
    return { routes: callback(createRouter(joinPatterns(basePattern, pattern))) };
  }

  function render(renderer: Renderer<any>, callback: any) {
    return { renderer, routes: callback(createRouter(basePattern)) };
  }

  function route(pattern: string, handler: any) {
    if (typeof handler === 'function') {
      return { pattern: joinPatterns(basePattern, pattern), handler };
    } else {
      return {
        pattern: joinPatterns(basePattern, pattern),
        async handler(arg: RouteArg<any>) {
          let resolved = (await resolveDynamicImport(handler)) as RouteHandler<any, T>;
          return resolved(arg);
        },
      };
    }
  }

  function use(middleware: Middleware<any> | Middleware<any>[], callback?: any) {
    if (typeof middleware === 'function') {
      return { middleware: [middleware], routes: callback?.(createRouter(basePattern)) };
    } else {
      return { middleware, routes: callback?.(createRouter(basePattern)) };
    }
  }

  return { lazy, mount, render, route, use } as Router<P, T>;
}

export function createRoutes<T = Response, const R extends AnyRoute<T>[] = AnyRoute<T>[]>(
  callback: (router: Router<'/', T>) => R,
): R {
  return callback(createRouter()) as R;
}

// export interface RouteMatch<T> {
//   middleware: Middleware<any>[];
//   renderer: Renderer<T>;
//   route: Route<any, T>;
// }

// export function matchRoutes<T>(routes: AnyRoute<T>[], url: URL): RouteMatch<T> | null {
//   let middleware: Middleware<any>[] = [];

//   for (let route of routes) {
//     if (hasChildren(route)) {
//       let match = matchRoutes(route.routes, url);

//       if (match != null) {
//         if (hasMiddleware(route)) {
//           route.middleware;
//           // Add this route's middleware to the stack
//         }

//         if (hasRenderer(route) && match.renderer == null) {
//           match.renderer = route.renderer;
//         }

//         return match;
//       }
//     }
//   }

//   return null;
// }

// function hasChildren<T>(route: AnyRoute<T>): route is AnyRoute<T> & { routes: AnyRoute<T>[] } {
//   return 'routes' in route && route.routes != null;
// }

// function hasMiddleware<T>(
//   route: AnyRoute<T>,
// ): route is AnyRoute<T> & { middleware: Middleware<any>[] } {
//   return 'middleware' in route && route.middleware != null;
// }

// function hasRenderer<T>(route: AnyRoute<T>): route is AnyRoute<T> & { renderer: Renderer<any> } {
//   return 'renderer' in route && route.renderer != null;
// }
