# Anti-patterns

Load this when reviewing or rewriting an existing JavaScript script. Each entry is a thing to remove or rewrite, with the better alternative.

## Use of `console.log` for diagnostics

Bad: `console.log("processing", file)` — pollutes stdout for any caller piping the output.

Good: `console.error("[info] processing", file)`. Keep `console.log` only for the structured output the user redirects with `> file.json` or pipes into `jq`.

## Sync filesystem APIs in `main`

Bad: `readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync` in the script's main flow. They block the event loop and serialize everything.

Good: `await readFile`, `await writeFile`, `await mkdir({recursive:true})` from `node:fs/promises`.

Exception: a single sync read of a config file at startup (before `main`) is fine. Inside any loop or async flow, never sync.

## CommonJS in 2025

Bad: `require()`, `module.exports`. Old habit; locks you out of modern Node features (top-level await, `node:` imports work in CJS but ESM is the default).

Good: ESM. Set `"type": "module"` in `package.json`, or use `.mjs` extension. `import { readFile } from "node:fs/promises"`.

## `exec` with user input

Bad: `exec(\`git log --since=${userInput}\`)` — command injection.

Good: `execFile("git", ["log", "--since", userInput])`. Args are an array, no shell interpretation.

## Bare `catch (e) { }` or `catch (e) { console.log(e) }`

Bad: silently swallowing errors, or printing them and continuing.

Good: catch specific error subclasses, decide whether to recover or rethrow, and use distinct exit codes:

```js
try {
  await readFile(path);
} catch (err) {
  if (err.code === "ENOENT") {
    log.warn(`file missing, skipping: ${path}`);
    return;
  }
  throw err; // rethrow anything we don't recognize
}
```

## `Promise.all` for batch work without limits

Bad: `await Promise.all(urls.map(fetchOne))` for 10,000 URLs — opens 10,000 sockets at once, hits OS file-descriptor limits, gets rate-limited.

Good: bounded concurrency with a pool / `p-limit` / a manual queue. See `patterns.md`.

## `fs.readFile` callback style

Bad: `fs.readFile(path, (err, data) => {...})`. Legacy; pyramid-of-doom prone.

Good: `await readFile(path, "utf8")` from `node:fs/promises`.

## Path concatenation with `+`

Bad: `\`${dir}/file.json\``— wrong on Windows; breaks if`dir` has trailing slash.

Good: `path.join(dir, "file.json")`.

## `__dirname` / `__filename` in ESM

Bad: `__dirname` in an ESM file — undefined.

Good: derive from `import.meta.url`:

```js
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
```

Or use `import.meta.dirname` (Node 21+ — check the project's floor before relying on it).

## `process.exit(0)` from inside async work

Bad: calling `process.exit(0)` mid-execution. Buffered stdout writes may be discarded; `finally` blocks may not run.

Good: bubble up a return value from `main()`. Top-level wrapper does the single `process.exit`.

## Hardcoded paths

Bad: `/Users/me/repo/config.json`. Breaks for any other user.

Good: `path.join(import.meta.dirname, "config.json")` (script-relative) or `process.env.CONFIG_PATH ?? path.join(...)` (configurable).

## Top-level `await` without a script entry guard

Bad: top-level `await` in a file that's also `import`-ed elsewhere — the import waits on the same code.

Good: wrap the script's runtime work in `main()` and gate it on whether the file was the entry:

```js
const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main()
    .then((c) => process.exit(c ?? 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

## `npm install` without a lockfile commit

Bad: a script with `npm install` in its docs but `package-lock.json` not committed. Reproducibility lost.

Good: commit `package-lock.json` (or `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`), and use `npm ci` (not `install`) in CI/install instructions.

## `axios` for one HTTP request

Bad: `npm i axios` for a single `fetch`. Adds a dep.

Good: use the global `fetch` (Node 18+). Same API as the browser. Reach for `axios` / `got` only if you need multipart, retries, interceptors, or cookie jars.

## Unhandled promise rejection without a process listener

Bad: a script that handles its own errors but has no `process.on("unhandledRejection", ...)`. A thrown error in a forgotten `.then` callback silently kills the process.

Good: register the listener at the top of the file, log the failure, exit non-zero.

## Sync `child_process.execSync` blocking

Bad: `execSync("git rev-parse HEAD")` in async code — blocks the event loop.

Good: `await execFileAsync("git", ["rev-parse", "HEAD"])`. Async by default.

## Logging full error objects without context

Bad: `log.error(err)` — prints just the message, loses the stack and `cause` chain.

Good: `log.error("operation failed:", err)`. Or with a structured logger (pino), `log.error({err, op}, "operation failed")` so the whole chain is captured.

## `JSON.parse` on untrusted input without a try

Bad: `const cfg = JSON.parse(await readFile(path, "utf8"))` — throws `SyntaxError` on bad input, but the error message doesn't say which file.

Good: wrap and re-throw with context:

```js
let cfg;
try {
  cfg = JSON.parse(await readFile(path, "utf8"));
} catch (err) {
  throw new Error(`invalid JSON in ${path}: ${err.message}`, { cause: err });
}
```

## "It works on my machine" Node version

Bad: code that uses `import.meta.dirname` (Node 21+) without declaring the engine in `package.json`.

Good: `"engines": { "node": ">=20" }` in `package.json`. CI fails fast on the wrong runtime.
