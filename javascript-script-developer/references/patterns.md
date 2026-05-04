# Patterns

Load this when implementing argument parsing, logging, error classes, file operations, or process lifecycle.

## Argument parsing with `node:util parseArgs` (Node 18+)

The built-in `parseArgs` is the right choice for any script under ~5 commands. Reach for `commander` / `yargs` only when you need nested subcommands with many options, deep help text, or completion scripts.

```js
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: {
    output: { type: "string", short: "o" },
    verbose: { type: "boolean", short: "v" },
    count: { type: "string", default: "10" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: true, // unknown flags fail the parse
});

if (values.help) {
  console.log("usage: my-script [options] <input>");
  process.exit(0);
}

const [input] = positionals;
const count = Number(values.count);
if (!Number.isFinite(count) || count <= 0) {
  console.error("--count must be a positive number");
  process.exit(2);
}
```

Notes:

- `parseArgs` only supports string and boolean. Numeric values are passed as strings; coerce + validate yourself.
- `strict: true` rejects unknown flags. Always set this for production scripts.
- Repeating flags: add `multiple: true`.
- Negation (`--no-cache`): handle by flipping the boolean default.

## Subcommands (without a CLI framework)

For 2-5 subcommands, dispatch manually:

```js
const subcommand = positionals[0];
const subArgs = positionals.slice(1);

const handlers = {
  build: (args) => runBuild(args),
  deploy: (args) => runDeploy(args),
  status: (args) => runStatus(args),
};

const handler = handlers[subcommand];
if (!handler) {
  console.error(`unknown subcommand: ${subcommand}`);
  console.error(`available: ${Object.keys(handlers).join(", ")}`);
  process.exit(2);
}
await handler(subArgs);
```

For 6+ subcommands or nested commands, use `commander` (`npm i commander`) — it's worth the dep.

## Logging

`console.error` for diagnostics, `console.log` only for the script's structured output (i.e., what a downstream `| jq` or pipe consumer reads). The two streams must not mix.

```js
const verbose = values.verbose;

const log = {
  debug: (...a) => verbose && console.error("[debug]", ...a),
  info: (...a) => console.error("[info]", ...a),
  warn: (...a) => console.error("[warn]", ...a),
  error: (...a) => console.error("[error]", ...a),
};
```

For non-trivial scripts, use `pino` (low-overhead structured JSON) or `winston` (more features). Both are stable.

## Error classes

Subclass `Error` for each distinct failure mode. Map subclasses to exit codes in `main`'s catch block.

```js
class UsageError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "UsageError";
    this.exitCode = 2;
  }
}

class InputError extends Error {
  constructor(msg, { path } = {}) {
    super(msg);
    this.name = "InputError";
    this.path = path;
    this.exitCode = 3;
  }
}

class NetworkError extends Error {
  constructor(msg, { cause } = {}) {
    super(msg, { cause });
    this.name = "NetworkError";
    this.exitCode = 4;
  }
}
```

Use the `cause` option (Node 16.9+) when wrapping a lower-level error so the chain is preserved.

## Top-level error handling

`main()` should be `async` and `return` an exit code. Top-level handles cleanup and exit:

```js
main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    if (err.exitCode != null) {
      log.error(err.message);
      process.exit(err.exitCode);
    }
    log.error("unexpected:", err);
    process.exit(1);
  });
```

Add process-level handlers as belt-and-suspenders:

```js
process.on("unhandledRejection", (reason) => {
  log.error("unhandled rejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  log.error("uncaught exception:", err);
  process.exit(1);
});
```

## Filesystem with `node:fs/promises`

Use the promise API. Avoid the sync API except for tiny one-shot reads at startup (e.g., reading a config file before `main` runs).

```js
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

// Read JSON
const cfg = JSON.parse(await readFile("config.json", "utf8"));

// Atomic write — write to .tmp then rename
async function writeAtomic(target, contents) {
  const tmp = `${target}.tmp.${process.pid}`;
  await writeFile(tmp, contents);
  await rename(tmp, target); // POSIX rename is atomic on the same filesystem
}

// Ensure parent dir exists
await mkdir(dirname(outPath), { recursive: true });
```

## Path handling

Always use `node:path`. For "the directory of this script", use `import.meta.url` + `fileURLToPath`:

```js
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "config.json");
```

Never concatenate paths with `+` or `${}` — `path.join` handles separators across OSes.

## SIGINT / SIGTERM (graceful shutdown)

Wire signals so a Ctrl-C doesn't leave half-written files or open sockets:

```js
const controller = new AbortController();
const onSignal = (sig) => {
  log.info(`received ${sig}, shutting down`);
  controller.abort();
};
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));

// Pass `controller.signal` into fetch / readFile / streams that accept it
await fetch(url, { signal: controller.signal });
```

Exit code for SIGINT is conventionally `130`.

## Spawning child processes

Use `node:child_process` `execFile` (not `exec`) when you control the args:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
```

Never use `exec` with user-provided strings — that's command injection. `execFile` takes args as an array and doesn't shell-interpret.

For long-running children, use `spawn` and stream stdout/stderr.

## Streams (large files)

For files that don't fit in memory, use streams:

```js
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

await pipeline(
  createReadStream(input),
  createGzip(),
  createWriteStream(output),
);
```

`pipeline` from `node:stream/promises` handles backpressure and error propagation correctly. Don't manually `.pipe()` and listen to `error` events — that's the legacy pattern that leaks file descriptors.

## Concurrency

For batch processing N items with bounded concurrency:

```js
async function pool(items, limit, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// Usage: process 100 URLs, 10 at a time
const data = await pool(urls, 10, fetchOne);
```

Or use `p-limit` (one of the few npm deps worth adding).

## Progress

For long loops, print to stderr periodically:

```js
let processed = 0;
const total = files.length;
const startedAt = Date.now();

for (const file of files) {
  await processOne(file);
  processed++;
  if (processed % 100 === 0 || processed === total) {
    const pct = ((processed / total) * 100).toFixed(1);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stderr.write(`\r${processed}/${total} (${pct}%, ${elapsed}s)`);
  }
}
process.stderr.write("\n");
```

For richer progress bars, `cli-progress` is the standard.

## Reading config

For JSON configs, `JSON.parse(await readFile(...))`. For YAML, `yaml` (the `eemeli/yaml` package) is fast and standard. For TOML, `@iarna/toml`.

For env vars with defaults:

```js
const PORT = Number(process.env.PORT ?? 3000);
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";
```

For env vars with secrets, use `dotenv` or — better — let the deployment platform inject them and crash fast if missing:

```js
function requireEnv(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`missing required env var: ${key}`);
    process.exit(2);
  }
  return v;
}
const apiKey = requireEnv("API_KEY");
```
