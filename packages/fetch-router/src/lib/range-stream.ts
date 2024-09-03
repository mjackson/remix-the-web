/**
 * A `TransformStream` that extracts a range of bytes from the input stream.
 */
export class RangeStream extends TransformStream<Uint8Array, Uint8Array> {
  /**
   * @param start The index of the first byte to include in the output.
   * @param end The index of the first byte to exclude from the output.
   */
  constructor(start: number, end: number) {
    if (start < 0 || end < 0 || start > end) {
      throw new RangeError(`Invalid range: ${start}-${end}`);
    }

    super(new RangeStreamTransformer(start, end));
  }
}

class RangeStreamTransformer implements Transformer<Uint8Array, Uint8Array> {
  #bytesRead: number;
  #start: number;
  #end: number;

  constructor(start: number, end: number) {
    this.#bytesRead = 0;
    this.#start = start;
    this.#end = end;
  }

  transform(chunk: Uint8Array, controller: TransformStreamDefaultController<Uint8Array>) {
    let chunkLength = chunk.byteLength;

    if (!(this.#bytesRead + chunkLength < this.#start || this.#bytesRead >= this.#end)) {
      let startIndex = Math.max(this.#start - this.#bytesRead, 0);
      let endIndex = Math.min(this.#end - this.#bytesRead, chunkLength);
      controller.enqueue(chunk.subarray(startIndex, endIndex));
    }

    this.#bytesRead += chunkLength;
  }
}
