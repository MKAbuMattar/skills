---
name: typescript-script-developer
description: Write production-ready TypeScript CLI tools, automation scripts, and batch file processors with strict type-checking — TypeScript 5.x with strict mode tsconfig, ESM, type-safe argument parsing via node:util parseArgs (with discriminated-union argv types), structured stderr logging, typed Error subclasses for distinct failure modes, exhaustiveness checks via 'never', node:fs/promises with branded types where useful, top-level await, graceful SIGINT/SIGTERM handling, and cross-platform support (Linux, macOS, Windows). Run scripts via tsx (default), Bun, or Deno; build for distribution with tsc. Targets Node.js 20 LTS and above plus TypeScript 5.4+. Use this skill whenever the user asks to create a TypeScript / TS / .ts script, typed Node CLI tool, automation, batch processor, or data pipeline — including casual phrasings like 'write a typescript script that ...', 'automate this in ts', 'make me a typed CLI', or 'I need a one-off TS processor'. Also use when reviewing or hardening an existing TypeScript script.
license: MIT. See LICENSE for full terms.
compatibility: Node.js 20 LTS or newer, TypeScript 5.4+, on Linux / macOS / Windows. Compatible with Bun 1.x and Deno 2.x via the `node:` import surface.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# TypeScript Script Developer

Production-ready TypeScript. Strict tsconfig + ESM + parseArgs with discriminated-union argv + typed Error subclasses + exhaustiveness via `never` + node:fs/promises + graceful signals.

## When to use

- The user asks for any `.ts` script, typed Node CLI, automation, or batch processor.
- The user wants to harden, refactor, or review an existing TypeScript script.
- A task chain ends in "and put it in a TS script".

Skip this skill for: plain JavaScript scripts (use `javascript-script-developer`), browser-only code, framework-bound code (Next.js, Express apps), or libraries (different shape).

## Required structure

Every script you write starts from this skeleton. Do not omit the entry guard, the typed catch, or the structured error class hierarchy.

```ts
#!/usr/bin/env node
/**
 * <one-line description>.
 *
 * Usage: tsx script.ts [options] <input>
 * Exit:  0 ok, 1 generic, 2 usage, 3 input, 130 interrupt
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import process from "node:process";

interface CliArgs {
  readonly input: string;
  readonly verbose: boolean;
}

abstract class ScriptError extends Error {
  abstract readonly kind: string;
  abstract readonly exitCode: number;
}

class UsageError extends ScriptError {
  readonly kind = "usage" as const;
  readonly exitCode = 2;
}

let verbose = false;
const log = {
  debug: (...a: readonly unknown[]): void => {
    if (verbose) process.stderr.write(`[debug] ${a.join(" ")}\n`);
  },
  info: (...a: readonly unknown[]): void =>
    process.stderr.write(`[info] ${a.join(" ")}\n`),
  error: (...a: readonly unknown[]): void =>
    process.stderr.write(`[error] ${a.join(" ")}\n`),
} as const;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    /* print help */ return 0;
  }
  if (positionals.length !== 1)
    throw new UsageError("expected exactly one positional argument");

  const args: CliArgs = {
    input: positionals[0]!,
    verbose: values.verbose ?? false,
  };
  verbose = args.verbose;

  process.on("SIGINT", () => process.exit(130));
  if (process.platform !== "win32")
    process.on("SIGTERM", () => process.exit(143));

  // ... real work ...
  return 0;
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err: unknown) => {
      if (err instanceof ScriptError) {
        log.error(err.message);
        process.exit(err.exitCode);
      }
      log.error("unexpected:", err instanceof Error ? err.stack : err);
      process.exit(1);
    });
}
```

## Workflow

1. **Confirm the package manager.** See `references/package-managers.md`. Save the answer to memory on first run.
2. **Confirm the runtime / build setup.** Default: Node.js 20+ run via `tsx` for development, built with `tsc` for distribution. If the user mentions Bun or Deno, load `references/runtimes-and-build.md`.
3. **Generate / verify `tsconfig.json`** using `assets/templates/tsconfig.template.json`. Always strict, always `noUncheckedIndexedAccess`, always `verbatimModuleSyntax`.
4. **Pick a starting template** from `assets/templates/`:
   - `script.template.ts` — single-purpose script.
   - `cli-tool.template.ts` — multi-subcommand CLI.
   - `file-processor.template.ts` — batch processing with bounded concurrency, typed pool.
5. **Apply patterns** from `references/patterns.md` for typed argv, discriminated-union errors, exhaustiveness checks, branded paths, async generators, typed pool, env validation with zod.
6. **Validate the result.** Run `node scripts/validate-script.mjs <your-script.ts>` — checks shebang, TSDoc, `import type`, `node:` prefix, explicit `main` return type, type/interface declarations, Error subclass with `exitCode`, no `any`, no `as any`, parseArgs, stderr logging, no sync fs, entry-guard, SIGINT. Aim for ≥ 90%.
7. **Type-check separately.** `npx tsc --noEmit` — `tsx` only strips types, it doesn't check them.
8. **Cross-check `references/anti-patterns.md`** — especially `any`, `as any`, missing `import type`, `enum` (prefer `as const` unions), `// @ts-ignore` (prefer `@ts-expect-error`).
9. **For cross-platform scripts**, load `references/cross-platform.md` and apply the rules.
10. **Generate man-page-style docs** using `references/documentation.md` — TSDoc on public APIs, plus a `<script>.md` reference.

## Available resources

- `assets/templates/{script,cli-tool,file-processor}.template.ts` — starting points.
- `assets/templates/tsconfig.template.json` — strict tsconfig with all the right flags.
- `assets/examples/csv-analyzer.ts` — full-featured reference (typed CSV streaming, gzip, discriminated-union errors, Welford running stats).
- `scripts/validate-script.mjs` — score a TS script against the checklist (run after writing).
- `references/patterns.md` — load when implementing typed argv, errors, branded types, exhaustiveness, env, async generators, concurrency.
- `references/anti-patterns.md` — load when reviewing or rewriting an existing TS script.
- `references/cross-platform.md` — load when targeting Windows or macOS alongside Linux.
- `references/runtimes-and-build.md` — load when picking tsx vs Bun vs Deno, building with tsc, or shipping a single binary.
- `references/package-managers.md` — load on first run to capture the user's preferred installer.
- `references/documentation.md` — load when generating man-page-style docs / TSDoc.

## Top gotchas (always inline — do not skip)

- **Strict tsconfig is non-negotiable.** `strict: true` + `noUncheckedIndexedAccess: true`. Anything less makes TypeScript a slower JavaScript.
- **`import type` for type-only imports.** With `verbatimModuleSyntax: true`, the compiler enforces this. It also stops accidental runtime imports of types.
- **`.js` extension in ESM imports.** Even when importing a `.ts` file. The compiler doesn't rewrite paths; the runtime reads `.js`.
- **`tsx` strips types — it does not type-check.** Run `tsc --noEmit` separately. CI must do both.
- **`unknown`, never `any`.** `any` opts out of type-checking. Every `any` is a bug waiting.
- **No `as` casts to escape the type system.** Use type guards or `zod`. The double-cast `as unknown as T` always hides a bug.
- **`catch (err)` infers `unknown`.** Narrow with `instanceof Error`, `err instanceof ScriptError`, or a custom type guard before using.
- **`__dirname` is undefined in ESM.** Use `dirname(fileURLToPath(import.meta.url))`.
- **Discriminated-union errors with `kind` plus `assertNever(default)`** for exhaustiveness. The compiler will tell you when you forget a case.
- **Subclass `Error` with `readonly exitCode: number`.** Map subclasses to codes in the top-level catch.
- **`as const` unions over `enum`.** TS enums have weird runtime semantics; `as const` plus a union type is cleaner and tree-shakable.
- **`// @ts-expect-error` not `@ts-ignore`.** The compiler tells you when the suppression is no longer needed.

## What you DO

1. Start every script from `assets/templates/`. Always with the matching `tsconfig.template.json`.
2. Use ESM (`import`, `node:` prefix). Use `import type` for type-only imports.
3. Define an `interface` for parsed argv. Validate types at the parseArgs boundary.
4. Define an abstract `ScriptError` base class; subclass per failure mode with `kind` literal + `readonly exitCode`.
5. Type `main(): Promise<number>` explicitly.
6. Annotate every public function's parameters and return type. Lean on inference inside.
7. Use `unknown` in catch blocks. Narrow with `instanceof` or a guard before using.
8. Use `assertNever` to enforce exhaustiveness on switches over discriminated unions.
9. Use `parseArgs` from `node:util`. Reach for commander/yargs only for complex CLIs.
10. Log to stderr. Reserve stdout for structured output.
11. Run `validate-script.mjs` and `tsc --noEmit` against the result.
12. Pin TypeScript to a major version in `package.json`.

## What you do NOT do

- Use `any`, or `as any`, or `as unknown as T` to escape the type system.
- Use TS `enum`s — prefer `as const` literal unions.
- Forget the `.js` extension in ESM imports of local `.ts` files.
- Use sync fs APIs in the main flow.
- Type-cast where a type guard or `zod` parse would work.
- Use `// @ts-ignore` — use `@ts-expect-error` with a comment instead.
- Mix `import` and `import type` randomly — turn on `verbatimModuleSyntax`.
- Throw strings or non-Error objects.
- Skip running `tsc --noEmit` because "tsx ran fine".
- Pin minor versions of TypeScript in production — the major-version pin is the contract.
- Write CommonJS in new code. ESM only.
