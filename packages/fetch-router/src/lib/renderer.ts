export interface Renderer<T = unknown> {
  render(value: T, init?: ResponseInit): Response | Promise<Response>;
}

export function createRenderer<T>(render: Renderer<T>['render']): Renderer<T> {
  return { render };
}

export const DefaultRenderer = createRenderer((value: BodyInit, init?: ResponseInit) => {
  return new Response(value, init);
});

export type DefaultRendererValueType = typeof DefaultRenderer extends Renderer<infer T> ? T : never;