# Anti-patterns

Load this when reviewing or rewriting an existing TypeScript script. Each entry names a pattern to remove and the better alternative.

## `any` in production code

Bad: `function process(data: any) { ... }` or `const result = JSON.parse(text)` (returns `any`).

Good: `unknown` plus narrowing, or a `zod` parse:

```ts
function process(data: unknown) {
  if (typeof data !== "object" || data === null) throw new Error("bad shape");
  // narrow further...
}
```

`any` opts out of type-checking. Every `any` is a bug waiting.

## Type assertions instead of narrowing

Bad: `(data as MyType).field` — compiler trusts you and lies.

Good: a type guard:

```ts
function isMyType(v: unknown): v is MyType {
  return typeof v === "object" && v !== null && "field" in v;
}
if (isMyType(data)) {
  data.field; // narrowed
}
```

Or `zod`:

```ts
const parsed = MyTypeSchema.parse(data);
parsed.field; // typed and validated
```

## `!` non-null assertions everywhere

Bad: `arr[0]!.name` peppered through the code.

Good: enable `noUncheckedIndexedAccess` in tsconfig, then handle the `undefined` case:

```ts
const first = arr[0];
if (!first) throw new Error("empty array");
first.name;
```

A single `!` after a guard you just checked is fine. A `!` per access is an unchecked invariant.

## Mixing `import` and `import type`

Bad: importing types for runtime — `import { MyType } from "./types"` compiles to a runtime import that does nothing useful.

Good: `import type { MyType } from "./types"` for type-only imports. With `verbatimModuleSyntax: true` in tsconfig, the compiler enforces this.

```ts
import type { Config } from "./config.js"; // erased at runtime
import { loadConfig } from "./config.js"; // runtime import
```

## `as unknown as T` to bypass the type checker

Bad: `(value as unknown as MyType)` to force a cast through `unknown`.

Good: figure out _why_ the original assertion failed. Either the input shape is genuinely uncertain (use a type guard or `zod`), or you're missing a type narrowing step.

The double-cast is almost always hiding a bug.

## Enum types

Bad: `enum Status { Ok, Fail }` — TS enums have weird runtime semantics, can't be tree-shaken cleanly, and don't compose with type-narrowing as well as unions.

Good: `as const` objects + literal union types:

```ts
const Status = {
  Ok: "ok",
  Fail: "fail",
} as const;
type Status = (typeof Status)[keyof typeof Status]; // "ok" | "fail"
```

Or just literal unions when you don't need a runtime object:

```ts
type Status = "ok" | "fail";
```

## CommonJS in 2025

Bad: `require()` / `module.exports` / `.cjs` files for new code.

Good: ESM. Set `"type": "module"` in `package.json`, `"module": "NodeNext"` in tsconfig, use `import` everywhere. TypeScript output is ESM. The whole pipeline is consistent.

## `tsc` for running scripts

Bad: `tsc && node dist/script.js` for every iteration during development. Slow.

Good: use `tsx` (`npx tsx script.ts`), Bun (`bun run script.ts`), or Deno (`deno run script.ts`). All execute TypeScript directly without a separate build step.

Build with `tsc` only when you ship — for example, when publishing an npm package.

## `tsconfig` without `strict: true`

Bad: a tsconfig that opts out of strict checks. Defeats the point of using TypeScript.

Good: `"strict": true` in tsconfig. Plus `"noUncheckedIndexedAccess": true` and `"exactOptionalPropertyTypes": true` if your code can handle them.

If a legacy file fails strict, don't loosen the project — fix the file or `// @ts-expect-error` the specific lines and track them.

## Ignoring errors with `// @ts-ignore`

Bad: `// @ts-ignore` — silently ignores errors and stays even after the underlying bug is fixed.

Good: `// @ts-expect-error` with a comment explaining why. The compiler complains if the underlying line _stops_ erroring, telling you to remove the suppression.

```ts
// @ts-expect-error: API client lacks types until v3 is released
const result = client.fancyNewMethod();
```

## Sync filesystem APIs in `main`

Bad: `readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync` in the script's main flow. They block the event loop and serialize everything.

Good: `await readFile`, `await writeFile`, `await mkdir({recursive:true})` from `node:fs/promises`.

## `axios` for one HTTP request

Bad: `npm i axios` plus `@types/axios` for a single `fetch`.

Good: the global `fetch` (Node 18+). Same API as the browser. TypeScript has built-in types from `@types/node`.

```ts
const res = await fetch(url);
if (!res.ok) throw new NetworkError(`fetch failed: ${res.status}`);
const data = (await res.json()) as unknown; // narrow / validate before use
```

## Throwing strings or non-Error objects

Bad: `throw "bad input"` or `throw { kind: "fail" }`. Loses the stack trace; breaks `instanceof` narrowing.

Good: `throw new InputError("bad input")`. Always throw an `Error` subclass.

## `JSON.parse` returning `any`

`JSON.parse` returns `any` by default, which silently propagates. With `noImplicitAny: true` it still types as `any` because that's the declared return type.

Good: cast to `unknown` immediately, then validate:

```ts
const parsed = JSON.parse(raw) as unknown;
const config = ConfigSchema.parse(parsed); // zod
```

Or wrap:

```ts
function parseJsonStrict<T>(raw: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(raw));
}
```

## Forgetting `.js` extension in ESM imports

Bad: `import { foo } from "./helpers"` — under `module: NodeNext`, this fails at runtime.

Good: include the `.js` extension even when importing a `.ts` file:

```ts
import { foo } from "./helpers.js"; // resolves to helpers.ts in source, helpers.js after build
```

The TypeScript compiler doesn't rewrite import paths. The `.js` extension is what the runtime sees. This is unintuitive but correct.

## Using `Object.keys` and expecting typed keys

Bad: `Object.keys(obj)` returns `string[]`, even if `obj` has a known type. The compiler is correct — JS objects can have extra inherited keys.

Good: use a type guard, or cast intentionally:

```ts
type ConfigKey = "apiUrl" | "timeout" | "retries";
const keys = Object.keys(config) as ConfigKey[]; // assert; we control config
```

Or iterate with `Object.entries` + a `satisfies` check:

```ts
for (const [k, v] of Object.entries(config) as [
  keyof typeof config,
  unknown,
][]) {
  // k is keyof typeof config
}
```

## Defining types at the wrong layer

Bad: putting all types in a single `types.ts` file at the top level. Becomes a bottleneck; every file imports it; circular import risk.

Good: define types where they're used. Export from a feature folder. Re-export only the types other features depend on.

## Forgetting `readonly`

Bad: `interface Config { apiUrl: string; }` — callers can mutate the field.

Good: `interface Config { readonly apiUrl: string; }` for any field that shouldn't change post-construction. Or `Readonly<T>` / `as const` for whole values.

For arrays: `readonly string[]` (preferred) or `ReadonlyArray<string>`.

## Leaking internal types in public APIs

Bad: a public function returns a private internal shape that drags in a hundred dependencies.

Good: declare the public return type explicitly. The compiler verifies the internal shape is assignable.

```ts
export function getStatus(): { ok: boolean; uptime: number } {
  // can return any value structurally compatible with the return type
}
```
