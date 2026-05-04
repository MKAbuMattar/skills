# Runtimes: Node, Bun, Deno

Load this when the user mentions Bun or Deno, or when "should I use Node or Bun?" comes up. The skill defaults to Node.js — most production scripts run there — but Bun and Deno are reasonable choices for specific cases.

## Node.js (the default)

- **Floor:** Node 20 LTS (security maintenance through April 2026; active LTS).
- **Ideal:** Node 22 LTS (active LTS through 2027).
- **Strengths:** widest ecosystem, longest track record, every npm package works.
- **Weaknesses:** ESM/CJS interop still has rough edges; sometimes-ugly DX for TypeScript (separate transpile or `tsx`).

When to pick Node: production scripts, CI tools, anything that needs broad library compatibility, anything a team will deploy onto pre-existing infra.

Run a script:

```bash
node script.js                    # ESM if "type":"module" in package.json or .mjs
node --watch script.js            # auto-restart on file change (Node 20+)
node --import tsx script.ts       # TypeScript via tsx loader
```

## Bun

- **Strengths:** fast cold start (~5x), built-in TypeScript / JSX, built-in test runner, drop-in `node:` API compatibility for most things, bundler included.
- **Weaknesses:** smaller ecosystem of edge cases, occasional incompatibility with native modules (e.g., older versions of bcrypt, sharp), less production track record than Node.

When to pick Bun: a self-contained script you want to run _fast_, dev tooling, anything where you'd otherwise reach for `tsx` + Node + various separate tools (test runner, bundler) — Bun rolls them in.

Run a script:

```bash
bun run script.js                 # JS or TS, ESM or CJS
bun --watch script.ts             # auto-restart
bun install <pkg>                 # uses npm registry by default
```

`node:fs`, `node:path`, `node:process`, `node:util parseArgs` etc. all work in Bun. Most of `patterns.md` carries over directly.

Bun has its own faster-but-less-portable APIs (`Bun.file()`, `Bun.spawn()`). Don't reach for those in a script unless the speed matters and the script is Bun-only.

## Deno

- **Strengths:** secure-by-default (explicit `--allow-net`, `--allow-read`), built-in TypeScript, built-in formatter and linter, built-in test runner, web-standard APIs (`fetch`, `Request`, `Response` are first-class), compile to single binary.
- **Weaknesses:** different ecosystem (npm interop has improved a lot but not 100%), URL-based imports historically (now supports `npm:` and `jsr:` specifiers), smaller community than Node.

When to pick Deno: scripts that benefit from the permission model (CI runners, sandbox-like execution), scripts you want to ship as a single binary (`deno compile`), TypeScript-heavy scripts where you want zero config.

Run a script:

```bash
deno run --allow-read script.ts   # explicit permission needed for fs reads
deno run -A script.ts             # all permissions (use sparingly)
deno run npm:tsx script.ts        # run an npm package directly
```

Most of this skill's patterns translate, but with caveats:

- Deno uses `Deno.args` instead of `process.argv`. Bun and Node use `process.argv`.
- Deno's stdlib is at `https://jsr.io/@std/...` (or `jsr:@std/...`).
- `node:util parseArgs` works under Deno's npm-compat shim.

## Choosing for a new script

| Need                                               | Pick                    |
| -------------------------------------------------- | ----------------------- |
| Production deploy onto existing Node infra         | Node                    |
| Maximum library compatibility (DB drivers, etc.)   | Node                    |
| Fastest cold start, single-tool DX (no extra deps) | Bun                     |
| Built-in TypeScript without `tsx` / `ts-node`      | Bun or Deno             |
| Sandboxed execution / explicit permissions         | Deno                    |
| Compile-to-single-binary distribution              | Deno                    |
| Team has no preference and infra is permissive     | Bun or Node — your call |

## Cross-runtime portability

For scripts that should run under any of the three:

- Stick to `node:` imports (all three support them).
- Avoid runtime-specific globals (`Bun.*`, `Deno.*`).
- Use `process.argv`; Deno polyfills it under npm-compat.
- Use `import.meta.url` (universal) over `__dirname` (CJS-only).
- Use the global `fetch` (all three).
- Test under each runtime you claim to support.

## Detecting the runtime

```js
const runtime =
  typeof Bun !== "undefined"
    ? "bun"
    : typeof Deno !== "undefined"
      ? "deno"
      : "node";
```

You should rarely need this. If branches grow, the script is becoming runtime-specific.

## When the user asks "should I use X?"

Default answer: Node 20+ unless there's a reason. Reasons that flip the recommendation:

- "I want a single binary" → Deno.
- "Cold start matters" (CLI tool invoked frequently) → Bun.
- "I want zero TypeScript config" → Bun or Deno.
- "It runs in CI alongside Python / Go" → Node (most CI images have it pre-installed).
- "I want explicit permissions" → Deno.

Don't recommend a runtime switch for an existing project — that's a bigger change than it looks. Recommend matching whatever the project uses today.
