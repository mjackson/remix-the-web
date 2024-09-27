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
  route<A extends string>(
    pattern: A,
    handler:
      | RouteHandler<JoinPatterns<E, A>, T>
      | DynamicImport<RouteHandler<JoinPatterns<E, A>, T>>,
  ): Route<JoinPatterns<E, A>, T>;

  lazy<A extends string>(
    pattern: A,
    handler: () => DynamicImport<RouteHandler<JoinPatterns<E, A>, T>>,
  ): Route<JoinPatterns<E, A>, T>;

  use<A extends string>(
    pattern: A,
    callback: (router: Router<JoinPatterns<E, A>, T>) => AnyRoute<T>[],
  ): PrefixRoute<T>;
  use(
    middleware: Middleware<E> | Middleware<E>[],
    callback?: (router: Router<E, T>) => AnyRoute<T>[],
  ): MiddlewareRoute<E, T>;
  use<T>(renderer: Renderer<T>, callback: (router: Router<E, T>) => AnyRoute<T>[]): RenderRoute<T>;
}

export function createRouter<P extends string = '/', T = Response>(pattern?: P): Router<P, T> {
  let basePattern = pattern ?? '/';

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

  function lazy(pattern: string, handler: any) {
    return {
      pattern: joinPatterns(basePattern, pattern),
      async handler(arg: RouteArg<any>) {
        let resolved = (await resolveDynamicImport(handler())) as RouteHandler<any, T>;
        return resolved(arg);
      },
    };
  }

  function use(arg: any, callback: any) {
    if (typeof arg === 'string') {
      return { routes: callback(createRouter(joinPatterns(basePattern, arg))) };
    } else if (typeof arg === 'function') {
      return { middleware: [arg], routes: callback?.(createRouter(basePattern)) };
    } else if (Array.isArray(arg)) {
      return { middleware: arg, routes: callback?.(createRouter(basePattern)) };
    } else {
      return { renderer: arg, routes: callback(createRouter(basePattern)) };
    }
  }

  return { route, lazy, use } as Router<P, T>;
}

export function createRoutes<T = Response, const R extends AnyRoute<T>[] = AnyRoute<T>[]>(
  callback: (router: Router<'/', T>) => R,
): R {
  return callback(createRouter()) as R;
}
