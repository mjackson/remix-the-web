export class RoutePattern<Source extends string = string> {
  #source: string;

  constructor(source: Source) {
    this.#source = source;
  }

  toString() {
    return this.#source;
  }
}
