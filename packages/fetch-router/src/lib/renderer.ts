export interface Renderer<T> {
  render(value: T): Response | Promise<Response>;
}

export function createRenderer<T>(render: Renderer<T>['render']): Renderer<T> {
  return { render };
}
