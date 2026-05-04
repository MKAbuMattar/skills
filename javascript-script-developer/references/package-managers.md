# Package managers

Load this on the first run to capture the user's preferred Node.js package manager. Save the answer to user memory so future runs skip the question.

## Detection

Check the project root for a lockfile, in this order:

| Lockfile            | Manager |
| ------------------- | ------- |
| `pnpm-lock.yaml`    | pnpm    |
| `yarn.lock`         | yarn    |
| `bun.lockb`         | bun     |
| `package-lock.json` | npm     |
| (none)              | ask     |

If multiple lockfiles exist, the project is in a confused state — surface it to the user before picking.

## Asking the user

If no lockfile is present and the user hasn't said which they prefer, ask once:

> Which Node package manager do you use — npm, pnpm, yarn, or bun? I'll use that for any install commands and remember it for next time.

Then save the answer to memory as a user preference.

## Install commands per manager

| Action                        | npm                               | pnpm                             | yarn                             | bun                                   |
| ----------------------------- | --------------------------------- | -------------------------------- | -------------------------------- | ------------------------------------- |
| Install all deps              | `npm install`                     | `pnpm install`                   | `yarn install`                   | `bun install`                         |
| Install all deps (CI, frozen) | `npm ci`                          | `pnpm install --frozen-lockfile` | `yarn install --frozen-lockfile` | `bun install --frozen-lockfile`       |
| Add a runtime dep             | `npm install <pkg>`               | `pnpm add <pkg>`                 | `yarn add <pkg>`                 | `bun add <pkg>`                       |
| Add a dev dep                 | `npm install -D <pkg>`            | `pnpm add -D <pkg>`              | `yarn add -D <pkg>`              | `bun add -d <pkg>`                    |
| Remove a dep                  | `npm uninstall <pkg>`             | `pnpm remove <pkg>`              | `yarn remove <pkg>`              | `bun remove <pkg>`                    |
| Run a script                  | `npm run <script>`                | `pnpm run <script>`              | `yarn <script>`                  | `bun run <script>`                    |
| Execute a binary              | `npx <bin>`                       | `pnpm exec <bin>`                | `yarn <bin>`                     | `bunx <bin>`                          |
| Update lockfile only          | `npm install --package-lock-only` | `pnpm install --lockfile-only`   | n/a (manual)                     | `bun install --frozen-lockfile=false` |

## Lockfiles

Always commit the lockfile. Never `.gitignore` it. The lockfile is what makes installs reproducible.

In CI, use the frozen-lockfile flavor (`npm ci`, `pnpm install --frozen-lockfile`, etc.) so a drifted lockfile fails CI loudly instead of silently regenerating.

## When the user has no preference

Recommend pnpm or npm:

- **pnpm** if the project is large, polyrepo, or has many packages — pnpm's symlink-based store is faster and smaller.
- **npm** if "fewest moving parts" matters — npm ships with Node.

Bun and yarn are both fine, but recommend them only when the user already prefers them or when the project depends on a feature unique to that manager (e.g., yarn workspaces protocol, bun's bundled runtime).

## `engines` in `package.json`

Always include the runtime floor:

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

Or pin specifically if the script uses a feature only in newer versions:

```json
{
  "engines": {
    "node": ">=22"
  }
}
```

This makes `npm install` warn (or fail with `--engine-strict`) on the wrong runtime, which catches the problem early.

## `packageManager` field (Corepack)

Modern projects pin the package manager via Corepack:

```json
{
  "packageManager": "pnpm@9.10.0"
}
```

This makes any developer hitting the project use the exact same manager version automatically (provided Corepack is enabled — `corepack enable`). Do this for any project with more than one contributor.

## When to write a `package.json` for a script

For a one-off script in an existing project, just add the dep to the existing `package.json`.

For a standalone script that needs deps, create a `package.json`:

```json
{
  "name": "my-script",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": {
    "my-script": "./bin/my-script.js"
  },
  "scripts": {
    "start": "node bin/my-script.js"
  },
  "dependencies": {
    "picocolors": "^1.1.1"
  }
}
```

The `"type": "module"` makes `.js` files ESM. The `"bin"` makes the script installable globally with `npm install -g .` and runnable as `my-script` from anywhere.

## When to skip `package.json` entirely

Single-file scripts using only the standard library don't need a `package.json`. A `.mjs` file with a shebang and `chmod +x` is fine:

```js
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const content = await readFile(process.argv[2], "utf8");
console.log(content.length);
```

Save as `count-chars`, `chmod +x count-chars`, run as `./count-chars file.txt`.
