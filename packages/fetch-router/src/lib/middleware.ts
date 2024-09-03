export interface Middleware {
  (request: Request, next: NextFunction): void | Response | Promise<void | Response>;
}

export interface NextFunction {
  (): Response | Promise<Response>;
}
