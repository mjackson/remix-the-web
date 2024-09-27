export function warning(condition: unknown, message: string): void {
  if (!condition) {
    if (typeof console !== 'undefined') {
      console.warn(message);
    }

    try {
      // Welcome to debugging Remix!
      //
      // This error is thrown as a convenience so you can more easily
      // find the source for a warning that appears in the console by
      // enabling "pause on exceptions" in your JavaScript debugger.
      throw new Error(message);
    } catch (e) {}
  }
}
