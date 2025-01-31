/**
 * A function that generates a Response for a given value.
 */
export interface Renderer<T> {
  (value: T, init?: ResponseInit): Response | Promise<Response>;
}

export const DefaultRenderer: Renderer<BodyInit> = (value: BodyInit, init?: ResponseInit) =>
  new Response(value, init);
