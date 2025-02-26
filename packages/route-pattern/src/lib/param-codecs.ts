export type ParamCodecs = Record<string, ParamCodec<any>>;

export interface ParamCodec<T> {
  /**
   * Parses a raw string value from a URL into a typed value.
   * @param input The raw string value to parse
   * @returns The parsed value
   */
  parse(input: string): T;
  /**
   * Converts a typed value into a raw string value that can be used in a URL.
   * @param value The typed value to convert
   * @returns The raw string value
   */
  stringify(value: T): string;
}
