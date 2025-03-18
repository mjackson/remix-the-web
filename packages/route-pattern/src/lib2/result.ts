type Ok<Value> = { ok: true; value: Value };
type Err = { ok: false; message: string };
export type Result<Value> = Ok<Value> | Err;

export const ok = <Value>(value: Value) => ({ ok: true as const, value });
export const err = (message: string): Err => ({ ok: false as const, message });
