import { RouteArg } from './route-handler.js';

export interface Middleware<P extends string = '/'> {
  (arg: RouteArg<P>, next: NextFunction): void | Response | Promise<void | Response>;
}

export interface NextFunction {
  (): Response | Promise<Response>;
}
