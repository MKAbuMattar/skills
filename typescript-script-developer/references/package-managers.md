# Package managers (TypeScript)

Load this on the first run to capture the user's preferred Node.js package manager. Same as the JavaScript version, with a few TypeScript-specific notes.

## Detection (same as JS)

Check the project root for a lockfile:

| Lockfile            | Manager |
| ------------------- | ------- |
| `pnpm-lock.yaml`    | pnpm    |
| `yarn.lock`         | yarn    |
| `bun.lockb`         | bun     |
| `package-lock.json` | npm     |

## Required dev dependencies for any TS script

Any TypeScript project needs at minimum:

```bash
npm install -D typescript @types/node
```

Add a runner for development:

```bash
npm install -D tsx           # recommended
# or
# Bun has TypeScript built in — no extra dep needed
# Deno has TypeScript built in — no extra dep needed
```

A reasonable starting `package.json`:

```json
{
  "name": "my-tool",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "start": "tsx src/cli.ts",
    "watch": "tsx --watch src/cli.ts"
  },
  "bin": {
    "my-tool": "dist/cli.js"
  },
  "files": ["dist"],
  "devDependencies": {
    "@tsconfig/node20": "^20.1.4",
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

## Pin TypeScript

Always pin TypeScript to a major version. TS minor releases are not strictly semver — minor bumps can introduce stricter inference that breaks code.

```json
{
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

The `^` allows patches and minor bumps within the major. Bump majors deliberately.

## `@types/*` packages

For most npm packages, types are bundled. Otherwise install `@types/<package>`:

```bash
npm install lodash
npm install -D @types/lodash
```

Always pin `@types/node` to your Node major:

```json
{
  "devDependencies": {
    "@types/node": "^20.14.0"
  }
}
```

`@types/node` for v20 has different APIs than for v18. Mismatch → confusing errors.

## Engines

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

For Bun-specific projects:

```json
{
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

Mixing both is fine if the script genuinely runs on either:

```json
{
  "engines": {
    "node": ">=20",
    "bun": ">=1.0.0"
  }
}
```

## `packageManager` field (Corepack)

Pin the manager + version for reproducibility:

```json
{
  "packageManager": "pnpm@9.10.0"
}
```

Run `corepack enable` once on the dev machine; from then on, anyone who runs `pnpm install` in the project gets the exact pinned version automatically.

## Common scripts

```json
{
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "format": "prettier --write src",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "tsx src/cli.ts",
    "watch": "tsx --watch src/cli.ts",
    "prepare": "tsc"
  }
}
```

The `prepare` script runs on `npm install`, `npm pack`, and global install — guarantees `dist/` exists before the package is consumed.

## When to use a monorepo tool

For one script: don't.

For 5+ related scripts that share types or utilities: use a monorepo tool. `pnpm` workspaces are simplest. `turborepo` adds caching for large projects. `Nx` adds project graph for very large projects.

A `pnpm-workspace.yaml` example:

```yaml
packages:
  - "scripts/*"
  - "shared"
```

## When to skip `package.json` entirely

For a single-file script using only the standard library, run it under tsx without a `package.json`:

```bash
npx tsx script.ts
```

`tsx` will work without a project, but you lose pinning and reproducibility. Add `package.json` the first time you need a dep.
