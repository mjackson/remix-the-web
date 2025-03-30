type Ok<Value> = { ok: true; value: Value };
type Err<E = string> = { ok: false; error: E };
export type Result<Value, E = string> = Ok<Value> | Err<E>;

export const ok = <Value>(value: Value) => ({ ok: true as const, value });
export const err = <E>(error: E): Err<E> => ({ ok: false as const, error });
