export interface Renderer<T> {
  render(value: T): Response | Promise<Response>;
}
