# Husky + lint-staged + Prettier (Node-only track)

Load this **only** when the repo is pure-Node (a single `package.json`, no Python / Go / Java / etc.) **and** the user explicitly asked for Husky. For any polyglot repo, use the `pre-commit` framework instead — Husky does not handle non-JS tooling cleanly.

## What this sets up

- **Husky** — manages git hooks via the `prepare` script in `package.json`.
- **lint-staged** — runs commands against only the staged files.
- **Prettier** — formats staged files automatically.
- Optional: **typecheck** + **test** scripts run on every commit (the heavyweight variant).

## Steps

### 1. Detect package manager

Check the lockfile, in this order:

| Lockfile            | Package manager |
| ------------------- | --------------- |
| `pnpm-lock.yaml`    | pnpm            |
| `yarn.lock`         | yarn            |
| `bun.lockb`         | bun             |
| `package-lock.json` | npm             |
| (none)              | npm (default)   |

### 2. Install dev dependencies

```bash
# npm
npm install --save-dev husky lint-staged prettier

# pnpm
pnpm add -D husky lint-staged prettier

# yarn
yarn add -D husky lint-staged prettier

# bun
bun add -d husky lint-staged prettier
```

### 3. Initialize Husky

```bash
npx husky init
```

This creates `.husky/`, writes `.husky/pre-commit`, and adds `"prepare": "husky"` to `package.json`.

### 4. Replace `.husky/pre-commit` with the project's pre-commit script

Use [`assets/templates/husky-pre-commit`](../assets/templates/husky-pre-commit). Husky v9+ does **not** need a shebang — Husky invokes the file via its own runner.

Default contents:

```bash
npx lint-staged
```

If the user opted into the heavyweight variant (typecheck + test on commit), use:

```bash
npx lint-staged
npm run typecheck
npm run test
```

(Replace `npm` with the detected package manager.)

**Warning:** Running `npm run test` on every commit is slow and is a trade-off — see the SKILL.md gotchas. Recommend it only when the user asked for it explicitly.

### 5. Create `.lintstagedrc.json`

Use [`assets/templates/lintstagedrc.json`](../assets/templates/lintstagedrc.json):

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

`--ignore-unknown` skips files Prettier can't parse (images, binaries, etc.).

For more aggressive setups:

```json
{
  "*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,md,yml,yaml,html,css}": "prettier --write"
}
```

### 6. Create `.prettierrc.json` if no Prettier config exists

Check for any of: `.prettierrc`, `.prettierrc.json`, `.prettierrc.yaml`, `.prettierrc.yml`, `.prettierrc.js`, `.prettierrc.cjs`, `prettier.config.js`, `prettier.config.cjs`, or a `prettier` key in `package.json`. If none, create [`assets/templates/prettierrc.json`](../assets/templates/prettierrc.json).

Defaults that match the most common community style:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 7. Add a `.prettierignore` if missing

```
# Build artifacts
dist/
build/
coverage/
.next/

# Dependencies
node_modules/

# Generated
**/*.min.js
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lockb
```

### 8. Verify

- [ ] `.husky/pre-commit` exists.
- [ ] `.lintstagedrc.json` exists.
- [ ] `prepare: "husky"` is in `package.json`.
- [ ] Prettier config exists.
- [ ] `npx lint-staged` runs without error on the current staged files.

### 9. Smoke test by committing

Stage all changed/created files and commit with a Conventional message:

```bash
git add .
git commit -m "chore: add pre-commit hooks (husky, lint-staged, prettier)"
```

The commit will run through the new hooks — that's the final smoke test.

## Adding ESLint

Most Node repos also want ESLint. Install:

```bash
npm install --save-dev eslint
```

Generate config:

```bash
npx eslint --init
```

Then update `.lintstagedrc.json` to include eslint-fix:

```json
{
  "*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,md,yml,yaml,html,css}": "prettier --write"
}
```

## Adding TypeScript type-checking

`tsc --noEmit` is project-scoped, not file-scoped, so it doesn't fit `lint-staged`'s per-file model. Two options:

1. **Run it separately in `.husky/pre-commit`** (slow but thorough):

   ```bash
   npx lint-staged
   npx tsc --noEmit
   ```

2. **Move type-checking to pre-push** to keep commits fast:

   ```bash
   # .husky/pre-push
   npx tsc --noEmit
   ```

   Install with `npx husky add .husky/pre-push 'npx tsc --noEmit'`.

## Adding commit-msg checks (Conventional Commits)

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

Create `commitlint.config.js`:

```javascript
module.exports = { extends: ["@commitlint/config-conventional"] };
```

Create `.husky/commit-msg`:

```bash
npx --no-install commitlint --edit "$1"
```

## When to switch to `pre-commit` instead

Switch if any of these are true:

- The repo gains a non-JS language (Python tooling, Java tooling, etc.).
- The team is uncomfortable installing Node deps just to manage git hooks.
- The CI runs in a non-Node environment that needs to invoke the same hooks.
- You want language-isolated hook environments (Husky + lint-staged shares the project's `node_modules`).

The `pre-commit` framework is the upgrade path. See `pre-commit-framework.md`.
