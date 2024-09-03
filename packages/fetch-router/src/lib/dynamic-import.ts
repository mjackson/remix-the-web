export type DynamicImport<T> = Promise<{ default: T }>;

export async function resolveDynamicImport<T>(value: DynamicImport<T>): Promise<T> {
  return (await value).default;
}
