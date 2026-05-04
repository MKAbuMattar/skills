# Patterns

Load this when implementing typed argv, discriminated-union errors, branded types, exhaustiveness checks, or process lifecycle in TypeScript.

## Strict tsconfig

Every script tsconfig should turn on the full strict suite, plus a few extras:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

Notes:

- `strict: true` enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.
- `noUncheckedIndexedAccess: true` makes `arr[0]` return `T | undefined` — the most useful strictness flag missing from the `strict` umbrella.
- `verbatimModuleSyntax` forces `import type` / `export type` discipline. Catches accidental runtime imports of types.
- `isolatedModules: true` makes the file safe for Bun / esbuild / SWC / tsx, all of which transpile per-file.
- `skipLibCheck: true` is fine for scripts; saves seconds per run.

## Typed argv with `parseArgs`

`parseArgs` is the right choice for any script under ~5 commands. With TypeScript, lift the types up:

```ts
import { parseArgs } from "node:util";
import process from "node:process";

interface CliArgs {
  readonly input: string;
  readonly output: string | undefined;
  readonly count: number;
  readonly verbose: boolean;
}

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string", short: "o" },
      count: { type: "string", default: "10" },
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (positionals.length !== 1) {
    throw new UsageError("expected exactly one positional argument: <input>");
  }

  const count = Number(values.count);
  if (!Number.isFinite(count) || count <= 0) {
    throw new UsageError("--count must be a positive number");
  }

  return {
    input: positionals[0]!,
    output: values.output,
    count,
    verbose: values.verbose ?? false,
  };
}
```

The `!` after `positionals[0]` is safe because we just checked `positionals.length === 1`. With `noUncheckedIndexedAccess`, this is the cleanest pattern.

## Discriminated-union error classes

Subclass `Error` for each failure mode, then narrow on the subclass in the catch block:

```ts
abstract class ScriptError extends Error {
  abstract readonly kind: string;
  abstract readonly exitCode: number;
}

class UsageError extends ScriptError {
  readonly kind = "usage" as const;
  readonly exitCode = 2;
}

class InputError extends ScriptError {
  readonly kind = "input" as const;
  readonly exitCode = 3;
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
  }
}

class NetworkError extends ScriptError {
  readonly kind = "network" as const;
  readonly exitCode = 4;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

type AnyScriptError = UsageError | InputError | NetworkError;
```

In the catch:

```ts
function isScriptError(e: unknown): e is AnyScriptError {
  return e instanceof ScriptError;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err: unknown) => {
    if (isScriptError(err)) {
      log.error(err.message);
      process.exit(err.exitCode);
    }
    log.error("unexpected:", err instanceof Error ? err.stack : err);
    process.exit(1);
  });
```

## Exhaustiveness checks with `never`

When you switch on a discriminant, `default: assertNever(x)` makes the compiler enforce that every case is handled:

```ts
function assertNever(x: never): never {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
}

function reportError(err: AnyScriptError): string {
  switch (err.kind) {
    case "usage":
      return `usage: ${err.message}`;
    case "input":
      return `input ${err.path}: ${err.message}`;
    case "network":
      return `network: ${err.message}`;
    default:
      return assertNever(err); // compile error if a case is missed
  }
}
```

## Branded types for path safety

When a string argument must be a specific _kind_ of path (validated input file, validated output dir), brand it:

```ts
type Brand<T, B> = T & { readonly __brand: B };

type ValidatedInputPath = Brand<string, "ValidatedInputPath">;
type ValidatedOutputPath = Brand<string, "ValidatedOutputPath">;

async function validateInput(p: string): Promise<ValidatedInputPath> {
  const s = await stat(p).catch(() => null);
  if (!s?.isFile()) throw new InputError("not a regular file", p);
  return p as ValidatedInputPath;
}

// Now functions can require a validated path:
async function process(path: ValidatedInputPath): Promise<void> {
  /* ... */
}
```

The runtime is just a string — the compiler enforces the gate.

## Type-safe env vars

```ts
function requireEnv(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    throw new UsageError(`missing required env var: ${key}`);
  }
  return v;
}

function optionalEnv<T>(key: string, defaultValue: T): string | T {
  return process.env[key] ?? defaultValue;
}

const apiKey = requireEnv("API_KEY"); // string
const port = Number(optionalEnv("PORT", "3000")); // number with default
const debug = process.env.DEBUG === "1";
```

For larger config schemas, use `zod` (`npm i zod`):

```ts
import { z } from "zod";

const EnvSchema = z.object({
  API_KEY: z.string().min(1),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("3000"),
  DEBUG: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
});

const env = EnvSchema.parse(process.env); // throws ZodError on missing/bad values
```

## Logger with proper types

```ts
type LogFn = (...args: unknown[]) => void;

interface Logger {
  readonly debug: LogFn;
  readonly info: LogFn;
  readonly warn: LogFn;
  readonly error: LogFn;
}

function createLogger(verbose: boolean): Logger {
  return {
    debug: (...a) => {
      if (verbose) process.stderr.write(`[debug] ${formatArgs(a)}\n`);
    },
    info: (...a) => process.stderr.write(`[info] ${formatArgs(a)}\n`),
    warn: (...a) => process.stderr.write(`[warn] ${formatArgs(a)}\n`),
    error: (...a) => process.stderr.write(`[error] ${formatArgs(a)}\n`),
  };
}

function formatArgs(args: readonly unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}
```

For non-trivial scripts, use `pino` — its TS typings are excellent and it's structured-JSON-by-default.

## Async iteration + AsyncGenerator

For walking large directories or processing streams of items, `AsyncGenerator` is the cleanest typed primitive:

```ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

for await (const file of walk("./src")) {
  console.error(file);
}
```

## Bounded concurrency, typed

```ts
async function pool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<readonly (R | { error: Error; item: T })[]> {
  const results: Promise<R | { error: Error; item: T }>[] = [];
  const executing = new Set<Promise<unknown>>();
  for (const item of items) {
    const p = Promise.resolve()
      .then(() => fn(item))
      .catch((err: Error) => ({ error: err, item }));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
```

`p-limit` is also fully typed and a small dep.

## Reading typed JSON config

For one-off scripts, validate at runtime with `zod`:

```ts
import { readFile } from "node:fs/promises";
import { z } from "zod";

const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  retries: z.number().int().nonnegative().default(3),
  features: z.object({
    cache: z.boolean().default(true),
    parallel: z.boolean().default(false),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

async function loadConfig(path: string): Promise<Config> {
  const raw = await readFile(path, "utf8").catch((err) => {
    throw new InputError(`cannot read ${path}: ${err.message}`, path);
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new InputError(
      `invalid JSON in ${path}: ${(err as Error).message}`,
      path,
    );
  }
  return ConfigSchema.parse(parsed); // throws ZodError on schema mismatch
}
```

## SIGINT / SIGTERM with AbortController

```ts
const controller = new AbortController();
const onSignal = (sig: NodeJS.Signals): void => {
  log.info(`received ${sig}, shutting down`);
  controller.abort();
};
process.on("SIGINT", () => onSignal("SIGINT"));
if (process.platform !== "win32") {
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}

await fetch(url, { signal: controller.signal });
```

## Unknown error narrowing

When catching `unknown` (which TS 4.4+ requires for `catch (err)`), narrow before using:

```ts
try {
  await readFile(path);
} catch (err) {
  if (err instanceof Error && "code" in err && err.code === "ENOENT") {
    log.warn(`file missing: ${path}`);
    return;
  }
  throw err;
}
```

For Node-specific error codes, define a type guard:

```ts
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
```
