export interface Renderer<T> {
  render(value: T): Response | Promise<Response>;
}

export function createRenderer<T>(render: Renderer<T>['render']): Renderer<T> {
  return { render };
}

export const DefaultRenderer = createRenderer((value: Response) => {
  if (value instanceof Response) {
    return value;
  }

  throw new TypeError('The default renderer is unable to render non-Response values');
});

export type DefaultRenderType = typeof DefaultRenderer extends Renderer<infer T> ? T : never;
