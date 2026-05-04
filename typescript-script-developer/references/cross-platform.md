# Cross-platform

Load this when targeting macOS / Windows / Linux from one TypeScript script. Most things "just work" with `node:fs/promises` and `node:path`. The TypeScript-specific aspect is mostly just adding types around the JS-side gotchas.

## Path separators

```ts
import { join } from "node:path";

const p = join(dir, "subdir", "file.txt");
// → "/dir/subdir/file.txt" on POSIX, "\\dir\\subdir\\file.txt" on Windows
```

For glob libraries (`fast-glob`, `globby`), forward slashes work in patterns even on Windows. But filesystem paths from `path.join` use the OS separator.

## Detecting the platform

```ts
import { platform } from "node:process";

type Platform =
  | "win32"
  | "darwin"
  | "linux"
  | "freebsd"
  | "openbsd"
  | "sunos"
  | "aix"
  | "android"
  | "cygwin"
  | "haiku"
  | "netbsd";

if (platform === "win32") {
  // Windows
} else if (platform === "darwin") {
  // macOS
} else {
  // Linux + others
}
```

`process.platform` is typed as the union above (from `@types/node`). `if (platform === "win32") { ... }` narrows correctly.

## Signals (typed)

```ts
import process from "node:process";

const onSignal = (sig: NodeJS.Signals): void => {
  console.error(`received ${sig}, shutting down`);
  process.exit(130);
};

process.on("SIGINT", () => onSignal("SIGINT"));
if (process.platform !== "win32") {
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}
```

`NodeJS.Signals` is typed in `@types/node` as the full set of POSIX signal names. Windows has no real `SIGTERM` — the `process.on` is silently a no-op there but still typechecks.

## Spawning child processes

For cross-platform child-process invocation, `cross-spawn` has TypeScript types via `@types/cross-spawn`:

```bash
npm install cross-spawn
npm install -D @types/cross-spawn
```

```ts
import { spawn } from "cross-spawn";

const child = spawn("npm", ["install"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
```

For `execFile` with explicit paths, the built-in types are fine:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { stdout, stderr } = await execFileAsync("git", ["rev-parse", "HEAD"]);
```

## Home / temp directories

```ts
import { homedir, tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

const home: string = homedir();
const temp: string = tmpdir();

// Unique temp dir
const myTmp = await mkdtemp(join(temp, "myscript-"));
try {
  // ... use myTmp ...
} finally {
  await rm(myTmp, { recursive: true, force: true });
}
```

## Console colors

Use `picocolors` (typed, tiny, fast) or `chalk`:

```ts
import pc from "picocolors";

console.error(pc.red("error:"), msg);
console.error(pc.dim("[debug]"), msg);
```

Both auto-detect color support. Both expose typed APIs out of the box. Manual ANSI escape codes work on modern Windows but not legacy `cmd.exe`.

## Exit codes (typed)

POSIX accepts 0-255. Use a typed enum-ish object:

```ts
const ExitCode = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  INPUT: 3,
  NETWORK: 4,
  TIMEOUT: 5,
  INTERRUPT: 130,
  TERMINATE: 143,
} as const;
type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

process.exit(ExitCode.OK);
```

## Shebang lines

`#!/usr/bin/env node` works on Linux/macOS. On Windows, npm wraps the binary in a `.cmd` shim when installed via the `bin` field. So:

```json
// package.json
{
  "bin": {
    "my-tool": "dist/cli.js"
  }
}
```

```ts
#!/usr/bin/env node
// dist/cli.js (built from src/cli.ts)
import { main } from "./index.js";
main();
```

For TypeScript, the `tsc` build preserves the shebang if it's in the source file. After build, `chmod +x dist/cli.js` (POSIX); npm handles Windows automatically on `npm install -g .`.

## Line endings

Always write LF. Don't write `\r\n` "for Windows compatibility" — Git handles conversion via `core.autocrlf`.

For _parsing_ mixed-ending files:

```ts
const content = await readFile(path, "utf8");
const lines: readonly string[] = content.split(/\r?\n/);
```

## Test on at least two

Cross-platform bugs hide until they hit a non-developer machine. Run the script on at least one POSIX (Linux / macOS) and Windows (or a Windows CI matrix) before declaring it cross-platform. Path separators and child-process quirks are the most common biters.

## Type-checking on every platform

If you run CI on multiple OSes, type-check on each. Some `@types/node` definitions are platform-conditional (e.g., `process.platform`'s narrowing). A rare bug: code that types correctly on Linux fails on Windows. CI catches this.
