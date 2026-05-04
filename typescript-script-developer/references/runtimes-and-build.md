# Runtimes and build

Load this for the "how do I run / build / ship a TypeScript script?" question.

## Running TypeScript directly (development)

For iteration on a script, you don't want a separate build step. Three good options:

### tsx (recommended for Node)

```bash
npm install -D tsx
npx tsx script.ts
npx tsx --watch script.ts    # auto-restart on file change
```

`tsx` is an esbuild-based loader. Fast, ESM-native, type-strips-only (does not type-check). Pair with `tsc --noEmit` for type-checking in CI.

### Bun

```bash
bun run script.ts            # JS or TS, no config needed
bun --watch script.ts        # auto-restart
```

Bun runs TypeScript natively. No setup. Fastest cold start.

### Deno

```bash
deno run --allow-read script.ts
```

Deno also runs TypeScript natively, with stricter security defaults. See `runtimes.md` (in `javascript-script-developer` if installed) for when to pick Deno.

### `node --import tsx` (Node 20+)

```bash
node --import tsx script.ts
```

Equivalent to `npx tsx script.ts` but lets you pass any `node` flag (`--inspect`, `--max-old-space-size`, etc.) directly.

## Type-checking (CI)

Always run `tsc --noEmit` in CI as a separate step. `tsx` and Bun strip types; they don't _check_ them. Without `tsc`, you'll merge code that runs but has type errors.

```bash
npx tsc --noEmit
```

In `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "start": "tsx src/index.ts"
  }
}
```

## Building for distribution

When shipping a TypeScript script as an npm package or as a checked-in JS file, build with `tsc`:

```bash
npx tsc
```

This emits `.js` and `.d.ts` files into `outDir`. The `package.json` should point to the built outputs:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "my-tool": "dist/cli.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepare": "tsc"
  }
}
```

`prepare` runs on `npm install -g .` and on `npm pack`, so your binary is always built before it's installed.

## Single-binary distribution

For shipping a TypeScript script as a single binary:

### `bun build --compile`

```bash
bun build --compile --target=bun src/cli.ts --outfile my-tool
```

Produces a self-contained binary including the Bun runtime. ~80-100 MB.

### `deno compile`

```bash
deno compile --allow-read --allow-net src/cli.ts --output my-tool
```

Produces a self-contained binary including the Deno runtime. ~70-90 MB.

### `pkg` (Node)

```bash
npx pkg dist/cli.js --output my-tool
```

Bundles `dist/cli.js` with a Node runtime. ~50-100 MB. Note: pkg is in maintenance mode; SEA (single-executable-application) in modern Node is the future.

### `node --experimental-sea-config` (Node 20+)

Node has built-in single-executable-application support, but it's still experimental as of Node 22. Wait until it's stable unless you have a strong reason.

## tsconfig presets

For most scripts:

```json
{
  "extends": "@tsconfig/node20/tsconfig.json",
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

Install: `npm install -D @tsconfig/node20`.

The shared `@tsconfig/*` configs cover Node version-specific defaults (target, lib, module). Pin to your Node floor.

For Node 22:

```json
{ "extends": "@tsconfig/node22/tsconfig.json" }
```

For Bun:

```json
{ "extends": "@tsconfig/bun/tsconfig.json" }
```

For Deno: Deno doesn't use tsconfig — it has its own `deno.json` config.

## When to skip the build

For one-off scripts (a helper for a single dev, run via `tsx` only) — skip the build entirely. Don't ship `dist/`. Just commit the `.ts` source and a script in `package.json`:

```json
{
  "scripts": {
    "my-tool": "tsx src/cli.ts"
  }
}
```

Run as `npm run my-tool -- --arg`.

## tsx vs ts-node

`tsx` and `ts-node` solve the same problem (run TypeScript without a build step). Differences:

- **`tsx`**: esbuild-based, fast, type-strips, ESM-first, fewer config knobs.
- **`ts-node`**: TypeScript-compiler-based, slower, full type-check option (`ts-node --type-check`), more config knobs.

For new projects, `tsx` is the default choice. `ts-node` is fine for legacy projects already using it.

## Picking a target

`target` in tsconfig sets which JS features the compiler downlevels. Match it to the lowest runtime you support:

| Runtime            | `target` |
| ------------------ | -------- |
| Node 22            | ES2024   |
| Node 20            | ES2023   |
| Node 18            | ES2022   |
| Bun (any current)  | ES2024   |
| Deno (any current) | ES2024   |
| Browsers (recent)  | ES2022   |

Going lower than necessary makes the output bigger and slower. Going higher means runtime errors when a feature is missing.

## Picking a module setting

For Node:

- `"module": "NodeNext"` + `"moduleResolution": "NodeNext"` — the modern default. Handles ESM and CJS interop correctly.
- `"module": "ESNext"` + `"moduleResolution": "Bundler"` — when bundling with esbuild / Vite / Rollup. Don't use for Node-direct execution.

For Bun:

- `"module": "ESNext"` + `"moduleResolution": "Bundler"` — Bun handles its own resolution.

For Deno:

- Deno doesn't read `module`. Configure via `deno.json` instead.

## Shipping types from a library

If your script is also imported as a library:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

Run `tsc` with `declaration: true` to emit `.d.ts` files alongside the `.js`.

For dual-publishing CJS + ESM, `tshy` or `tsup` handle the build complexity.
