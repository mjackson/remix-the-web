import { DynamicImport, resolveDynamicImport } from './dynamic-import.js';
import { Middleware } from './middleware.js';
import { Renderer, DefaultRenderer } from './renderer.js';
import { RouteHandler, RouteArg } from './route-handler.js';
import { RoutePattern, JoinPatterns, joinPatterns } from './route-pattern.js';

type DefaultRenderType = typeof DefaultRenderer extends Renderer<infer T> ? T : never;

export type AnyRoute<T> =
  | Route<any, T>
  | PrefixRoute<T>
  | MiddlewareRoute<any, T>
  | RenderRoute<any>;

export interface Route<P extends string, T> {
  pattern: RoutePattern<P>;
  handler: RouteHandler<P, T>;
}

export interface PrefixRoute<T> {
  children: AnyRoute<T>[];
}

export interface MiddlewareRoute<P extends string, T> {
  middleware: Middleware<P>[];
  children?: AnyRoute<T>[];
}

export interface RenderRoute<T> {
  renderer: Renderer<T>;
  children: AnyRoute<T>[];
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

export function createRouter<P extends string = '/', T = DefaultRenderType>(
  pattern?: P,
): Router<P, T> {
  let basePattern = pattern ?? '/';
  let router = {
    lazy(pattern: string, handler: any): Route<string, T> {
      return {
        pattern: new RoutePattern(joinPatterns(basePattern, pattern)),
        async handler(arg: RouteArg<any>) {
          let resolved = (await resolveDynamicImport(handler())) as RouteHandler<any, T>;
          return resolved(arg);
        },
      };
    },
    mount(pattern: string, callback: any): PrefixRoute<T> {
      return { children: callback(createRouter(joinPatterns(basePattern, pattern))) };
    },
    render(renderer: Renderer<any>, callback: any): RenderRoute<any> {
      return { renderer, children: callback(router) };
    },
    route(pattern: string, handler: any): Route<string, T> {
      if (typeof handler === 'function') {
        return { pattern: new RoutePattern(joinPatterns(basePattern, pattern)), handler };
      } else {
        return {
          pattern: new RoutePattern(joinPatterns(basePattern, pattern)),
          async handler(arg: RouteArg<any>) {
            let resolved = (await resolveDynamicImport(handler)) as RouteHandler<any, T>;
            return resolved(arg);
          },
        };
      }
    },
    use(middleware: Middleware<any> | Middleware<any>[], callback?: any): MiddlewareRoute<any, T> {
      if (typeof middleware === 'function') {
        return { middleware: [middleware], children: callback?.(router) };
      } else {
        return { middleware, children: callback?.(router) };
      }
    },
  };

  return router as Router<P, T>;
}

export function createRoutes<T = DefaultRenderType, const R extends AnyRoute<T>[] = AnyRoute<T>[]>(
  callback: (router: Router<'/', T>) => R,
): R {
  return callback(createRouter()) as R;
}
