# Cross-platform

Load this when targeting macOS / Windows / Linux from one script. Most things "just work" with `node:fs/promises` and `node:path`, but a handful of details bite.

## Path separators

Always use `path.join`, `path.resolve`, `path.dirname`, `path.basename`. Never concatenate with `/` or `\`.

```js
import { join } from "node:path";
const p = join(dir, "subdir", "file.txt");
// → "/dir/subdir/file.txt" on POSIX, "\\dir\\subdir\\file.txt" on Windows
```

For shell glob patterns (which you probably should avoid in scripts — use `node:fs.glob` or `fast-glob` instead), forward slashes work in the glob library even on Windows. But filesystem paths use the OS separator.

## Line endings

By default, `writeFile(path, "one\ntwo\n")` writes LF on every OS. That's correct — Git handles the conversion if needed.

Don't write `\r\n` "for Windows compatibility" — it'll break git diffs and produce mixed-ending files.

If you need to _parse_ a file with mixed endings:

```js
const content = await readFile(path, "utf8");
const lines = content.split(/\r?\n/);
```

## Detecting the platform

```js
import { platform } from "node:process";

if (platform === "win32") {
  // Windows
} else if (platform === "darwin") {
  // macOS
} else {
  // linux, freebsd, openbsd, sunos, aix, etc.
}
```

## Executable suffix

Windows expects `.exe`, `.cmd`, `.bat`. POSIX has none.

```js
const exeName = process.platform === "win32" ? "tool.exe" : "tool";
```

For invoking a tool that might be installed globally with a `.cmd` shim (e.g., `npm`), use `shell: true` in `spawn` _only when you control the args_ — or use `cross-spawn` which abstracts this.

## Spawning child processes

Built-in `spawn` on Windows requires either:

- The full path to a `.exe`, **or**
- `shell: true` for `.cmd` / `.bat` shims.

The simplest cross-platform approach: use `cross-spawn` (`npm i cross-spawn`). Drop-in replacement for `node:child_process.spawn` that handles Windows quoting and shim resolution.

```js
import { spawn } from "cross-spawn";

const child = spawn("npm", ["install"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code));
```

For `execFile`-style one-shot commands, the issue is the same. If you need to invoke `npm` / `git` / etc., either pin to the absolute path or use `cross-spawn`.

## Signals

Windows has no real `SIGTERM` / `SIGUSR1` / `SIGUSR2`. `process.on("SIGTERM", ...)` is a no-op there. `SIGINT` (Ctrl-C) works.

For graceful shutdown that works everywhere: register `SIGINT` always, and `SIGTERM` only on POSIX.

```js
process.on("SIGINT", shutdown);
if (process.platform !== "win32") {
  process.on("SIGTERM", shutdown);
}
```

## Home directory

```js
import { homedir } from "node:os";
const home = homedir(); // /Users/x on macOS, /home/x on Linux, C:\Users\x on Windows
```

Don't read `$HOME` directly — undefined on Windows. `homedir()` works everywhere.

## Temp directory

```js
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";

const tmp = await mkdtemp(join(tmpdir(), "myscript-"));
// → /tmp/myscript-X7y9pQ on POSIX, C:\Users\x\AppData\Local\Temp\myscript-X7y9pQ on Windows
```

`mkdtemp` creates a unique directory and returns the path. Clean up with `rm(tmp, {recursive:true})` when done — or use `try/finally`.

## Console colors

Most terminals on all three OSes support ANSI colors now. Use `picocolors` (tiny, fast) or `chalk`. They both detect color support correctly across:

- Windows Terminal, ConEmu, modern PowerShell.
- macOS Terminal, iTerm2, Warp.
- Linux gnome-terminal, alacritty, kitty, etc.
- CI environments (where they auto-disable).

```js
import pc from "picocolors";
console.error(pc.red("error:"), msg);
console.error(pc.dim("[debug]"), msg);
```

Manual ANSI escape codes (`\x1b[31m`) work on modern Windows 10+ but not on legacy `cmd.exe`. Use the library.

## File modes / permissions

POSIX permissions (rwx) don't translate cleanly to Windows. `chmod` is mostly a no-op on Windows except for the read-only bit.

If you write a script that needs to be executable on POSIX but doesn't matter on Windows, just `chmod 755` it after creation:

```js
import { chmod } from "node:fs/promises";
if (process.platform !== "win32") {
  await chmod(scriptPath, 0o755);
}
```

For lockfiles or token files that need to be private (`0600`), the same pattern — POSIX only.

## Shebang lines

`#!/usr/bin/env node` works on Linux/macOS. Windows ignores it but `npm` knows how to wrap a shebang script in a `.cmd` shim when you `npm link` or install via `bin` in `package.json`. So:

```json
// package.json
{
  "bin": {
    "my-tool": "./bin/my-tool.js"
  }
}
```

```js
#!/usr/bin/env node
// bin/my-tool.js
import { ... } from "...";
```

After `npm install -g .` (or `npm link` for development), `my-tool` works on all three OSes.

## Network: localhost binding

`server.listen(3000)` binds to all interfaces on POSIX but only IPv4 localhost on some configurations. To be explicit and consistent:

```js
server.listen(3000, "127.0.0.1");
// or
server.listen(3000, "0.0.0.0"); // all interfaces, intentionally
```

Don't bind to `localhost` as a hostname — DNS resolution differs across OSes (and `/etc/hosts` versus Windows hosts file).

## Process exit codes

POSIX accepts 0-255. Windows accepts 32-bit signed integers but anything above 255 gets truncated when invoked from POSIX. Stick to 0-255.

Conventional codes:

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 0    | Success                            |
| 1    | Generic error                      |
| 2    | Usage / bad arguments              |
| 3-9  | Application-specific failure modes |
| 130  | Killed by SIGINT (Ctrl-C)          |
| 143  | Killed by SIGTERM                  |

## Test on at least two

If the script will run on more than one OS, test on at least one POSIX and Windows (or a Windows-CI matrix). The path separator and child-process quirks bite the most — both are visible in the first 10 minutes of running on the other OS.
