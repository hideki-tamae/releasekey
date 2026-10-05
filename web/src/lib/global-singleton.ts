// One shared instance per server process, kept on globalThis.
//
// Why: in `next dev`, a Server Component (e.g. /release/result) and an API
// route (e.g. /api/threads) can each get their own copy of a module. A plain
// `export const store = new Store()` would then give two stores, and a record
// created in one would be invisible in the other. Keeping the instance on
// globalThis makes every copy of the module share the same one.
//
// Tests do not use this: they construct their own instances.

export function globalSingleton<T>(key: string, create: () => T): T {
  const g = globalThis as unknown as Record<string, T | undefined>;
  if (g[key] === undefined) g[key] = create();
  return g[key] as T;
}
