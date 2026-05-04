---
name: javascript-script-developer
description: Write production-ready Node.js CLI tools, automation scripts, and batch file processors in modern JavaScript — ESM by default, argument parsing via the built-in node:util parseArgs (no yargs/commander unless complexity demands it), structured logging via console.error or a logger (never console.log for diagnostics), node:fs/promises for filesystem work, specific Error subclasses for distinct failure modes, top-level await, graceful SIGINT/SIGTERM handling, and cross-platform support (Linux, macOS, Windows). Targets Node.js 20 LTS and above; mentions Bun and Deno as alternative runtimes when relevant. Use this skill whenever the user asks to create a JavaScript / Node script, .js or .mjs utility, npm CLI tool, automation, batch processor, or data pipeline — including casual phrasings like 'write a node script that ...', 'automate this in JS', 'make me a small CLI', or 'I need a one-off processor'. Also use when reviewing or hardening an existing JavaScript script.
license: MIT. See LICENSE for full terms.
compatibility: Node.js 20 LTS or newer on Linux, macOS, or Windows. Compatible with Bun 1.x and Deno 2.x via the `node:` import surface.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# JavaScript Script Developer

Production-ready Node.js. ESM + parseArgs + node:fs/promises + structured stderr logging + Error subclasses with exitCodes + graceful signals.

## When to use

- The user asks for any `.js` / `.mjs` script, Node CLI tool, automation, or batch processor.
- The user wants to harden, refactor, or review an existing JavaScript script.
- A task chain ends in "and put it in a node script".

Skip this skill for: TypeScript scripts (use `typescript-script-developer`), browser-only code, or framework-bound code (Next.js, Express apps).

## Required structure

Every script you write starts from this skeleton. Do not omit the entry guard, the `process.exit(0)` from the catch block, or the structured error subclass.

```js
#!/usr/bin/env node
/**
 * <one-line description>.
 *
 * usage: <name> [options] <input>
 * exit:  0 ok, 1 generic, 2 usage, 130 interrupt
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import process from "node:process";

let verbose = false;
const log = {
  debug: (...a) => verbose && process.stderr.write(`[debug] ${a.join(" ")}\n`),
  info:  (...a) => process.stderr.write(`[info] ${a.join(" ")}\n`),
  warn:  (...a) => process.stderr.write(`[warn] ${a.join(" ")}\n`),
  error: (...a) => process.stderr.write(`[error] ${a.join(" ")}\n`),
};

class UsageError extends Error {
  constructor(msg) { super(msg); this.exitCode = 2; }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      output:  { type: "string",  short: "o" },
      verbose: { type: "boolean", short: "v" },
      help:    { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });
  verbose = values.verbose ?? false;
  if (values.help) { /* print help */ return 0; }

  process.on("SIGINT", () => process.exit(130));
  if (process.platform !== "win32") process.on("SIGTERM", () => process.exit(143));

  // ... real work ...
  return 0;
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      if (err.exitCode != null) { log.error(err.message); process.exit(err.exitCode); }
      log.error("unexpected:", err.stack ?? err.message);
      process.exit(1);
    });
}
```

## Workflow

1. **Confirm the package manager.** If the script imports anything outside the standard library, install commands must use the user's preferred manager. See `references/package-managers.md` — read it on the first run, then save the answer to user memory so future runs skip the question.
2. **Confirm the runtime.** Default is Node.js 20+. If the user mentions Bun or Deno, load `references/runtimes.md` to pick the right one.
3. **Pick a starting template** from `assets/templates/`:
   - `script.template.js` — single-purpose script.
   - `cli-tool.template.js` — multi-subcommand CLI.
   - `file-processor.template.js` — batch processing with bounded concurrency.
4. **Apply patterns** from `references/patterns.md` for argv parsing, logging, error classes, fs, signals, child_process, streams, concurrency, progress.
5. **Validate the result.** Run `node scripts/validate-script.mjs <your-script.js>` — it checks shebang, ESM, `node:` prefix, parseArgs, stderr logging, no sync fs, no `require()`, error subclass, main+entry-guard, SIGINT. Aim for ≥ 90%.
6. **Cross-check `references/anti-patterns.md`** — especially `console.log` for diagnostics, sync fs, `exec` with user input, hardcoded paths, `Promise.all` without bounded concurrency.
7. **For cross-platform scripts**, load `references/cross-platform.md` and apply the rules (path separators, signals, `cross-spawn` for Windows, exit codes).
8. **Generate man-page-style docs** using `references/documentation.md` — either inline or as `<script>.md` next to the file.

## Available resources

- `assets/templates/{script,cli-tool,file-processor}.template.js` — starting points.
- `assets/examples/csv-analyzer.js` — full-featured reference implementation (CSV streaming, gzip, custom error classes, Welford running stats).
- `scripts/validate-script.mjs` — score a script against the checklist (run after writing).
- `references/patterns.md` — load when implementing parseArgs, logging, errors, fs, signals, child_process, streams, concurrency, progress, env vars.
- `references/anti-patterns.md` — load when reviewing or rewriting an existing script.
- `references/cross-platform.md` — load when targeting Windows or macOS alongside Linux.
- `references/runtimes.md` — load when the user mentions Bun or Deno, or when picking a runtime.
- `references/package-managers.md` — load on the first run to capture the user's preferred installer (npm / pnpm / yarn / bun).
- `references/documentation.md` — load when generating man-page-style script reference docs.

## Top gotchas (always inline — do not skip)

- **`console.error` (or stderr writes), never `console.log`** for diagnostics. Reserve `console.log` for the script's structured *output*. Mixing the two breaks downstream pipes.
- **`node:fs/promises`, never sync APIs** in the main flow. `readFileSync` / `writeFileSync` / `existsSync` block the event loop.
- **ESM, not CommonJS.** `import`, not `require()`. Set `"type": "module"` in `package.json`, or use `.mjs`.
- **`execFile`, not `exec`** for child processes — `exec` with user-controlled args is command injection.
- **`path.join`, never `+` or `${}`** for filesystem paths. Windows uses `\`.
- **`__dirname` is undefined in ESM.** Use `dirname(fileURLToPath(import.meta.url))`.
- **Entry guard required.** Wrap `main()` in `if (process.argv[1] === fileURLToPath(import.meta.url))` so the file is safe to `import`.
- **Subclass `Error` with `exitCode`** for each distinct failure mode. Map subclasses to exit codes in the top-level catch.
- **`process.on("unhandledRejection")` and `process.on("uncaughtException")`** as belt-and-suspenders. Don't silently die.
- **`Promise.all` with no concurrency limit will fail at scale.** Bounded pool / `p-limit` for any batch over ~50 items.
- **SIGINT exits with 130. SIGTERM exits with 143.** Don't pick arbitrary codes.
- **`engines.node` in `package.json`** so `npm install` warns on the wrong runtime.

## What you DO

1. Start every script from `assets/templates/`.
2. Use ESM (`import`, `node:` prefix).
3. Parse args with `parseArgs` from `node:util`. Reach for commander/yargs only when the CLI has many subcommands or deep help.
4. Log to stderr. Reserve stdout for the script's structured output.
5. Use `node:fs/promises` for all filesystem work. Use streams for files that don't fit in memory.
6. Subclass `Error` for each failure mode and attach `exitCode`.
7. Wrap top-level work in `async function main()`, gate execution on the entry-guard check.
8. Register `SIGINT` (and `SIGTERM` on POSIX) for graceful shutdown.
9. Use `cross-spawn` (or `execFile` with explicit paths) when invoking child processes that should work on Windows.
10. Pin the runtime floor in `package.json` `engines` field.
11. Run `validate-script.mjs` against the result; iterate until ≥ 90%.

## What you do NOT do

- Use `console.log` for log lines.
- Use sync fs APIs (`readFileSync`, `writeFileSync`, etc.) outside startup.
- Use `require()` or `module.exports` — ESM only.
- Pass user-controlled strings to `exec`. Use `execFile` with array args.
- Concatenate paths with `+` or `${}`. Use `path.join`.
- Use `__dirname` / `__filename` in ESM. Derive from `import.meta.url`.
- Run `Promise.all` over thousands of tasks without bounded concurrency.
- Add `axios`/`got` for a single HTTP call — global `fetch` works (Node 18+).
- Hardcode absolute paths. Use script-relative or env-var-configurable.
- Skip the lockfile. `package-lock.json` / `pnpm-lock.yaml` etc. must be committed.
- Use deprecated callback-style fs APIs. Promise APIs only.
