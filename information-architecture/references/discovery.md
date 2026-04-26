# Codebase Discovery Checklist

Run this **before** designing the IA. The point is to learn what already exists so the new architecture *extends* it instead of replacing it. Use a background `Explore` subagent — you don't need to read every file, just enumerate what's there.

## What to scan for

| Concern | Where to look | What to extract |
| --- | --- | --- |
| Routing | `app/`, `pages/`, router config (Next.js, React Router, Vue Router, SvelteKit, Remix), static HTML page files | Existing routes, dynamic-segment conventions, route groups |
| Navigation components | `components/`, `ui/`, `layout/`, names like `Header`, `Sidebar`, `Navbar`, `Breadcrumb`, `Footer`, `MobileNav` | What the current nav looks like; can it be extended? |
| Layout shells | Root `layout.{tsx,vue,svelte}`, nested layouts, `App.tsx`, `_app.tsx`, page wrappers, container components | The wrapping structure new pages plug into |
| Page directories | How pages are physically organized — by feature, by route, by domain | The naming and grouping convention to follow |
| URL patterns | Existing slugs, dynamic segments (`[id]`, `:slug`), query-param conventions for filtering/sorting/pagination | The grammar to keep new URLs consistent with |
| Content / data layer | `content/`, `data/`, MDX files, CMS adapter, API routes, schemas, GraphQL types, RPC contracts | Existing content models that the IA must accommodate |
| Naming conventions | File naming (kebab-case vs PascalCase), folder grouping (by feature vs by type) | The conventions every new page/component must follow |
| Tokens / theme | `tokens.css`, `globals.css`, Tailwind config, theme providers, design-tokens packages | What styling primitives exist; which the new pages will reuse |
| Test patterns | `*.test.*` co-located vs separate `__tests__/` | Whether new tasks should include test expectations |
| Dependencies | `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `composer.json`, etc. | UI libraries, animation libraries, icon sets already installed (no need to introduce new ones lightly) |
| Package manager | Lockfiles (see "Package manager detection" below) | Which `install` / `add` / `run` commands the generated tasks must use |

## Package manager detection

Tasks in `PLAN.md` / `TASKS.md` will reference install commands, run commands, and dev-dependency adds. Those commands **must** match the package manager the project actually uses — never default to `pip` / `npm` if the repo uses something else. Detect by lockfile and toolchain config; fall back to manifest-only when no lockfile exists.

### Python

| Lockfile / config | Manager | Install / add | Run a tool |
| --- | --- | --- | --- |
| `uv.lock` or `pyproject.toml` with `[tool.uv]` / `[tool.uv.workspace]` | **uv** | `uv add <pkg>` (project) or `uv pip install <pkg>` (raw) | `uv run <cmd>` / `uvx <tool>` |
| `poetry.lock` or `pyproject.toml` with `[tool.poetry]` | **Poetry** | `poetry add <pkg>` | `poetry run <cmd>` |
| `pdm.lock` or `pyproject.toml` with `[tool.pdm]` | **PDM** | `pdm add <pkg>` | `pdm run <cmd>` |
| `Pipfile.lock` / `Pipfile` | **pipenv** | `pipenv install <pkg>` | `pipenv run <cmd>` |
| Plain `requirements.txt` only | **pip** | `pip install <pkg>` | `python -m <module>` / direct call |
| `environment.yml` / `meta.yaml` | **conda / mamba** | `conda install <pkg>` | `conda run -n <env> <cmd>` |

If multiple are present (e.g. a `requirements.txt` *and* a `pyproject.toml` with a `uv.lock`), the **lockfile wins** — that's the source of truth.

If the user previously stated a preference for a specific manager (it may have been saved to user memory by a sibling skill like `python-script-developer`), honor that preference.

### Node / JS / TS

| Lockfile | Manager | Install / add | Run a script |
| --- | --- | --- | --- |
| `pnpm-lock.yaml` | **pnpm** | `pnpm add <pkg>` | `pnpm <script>` / `pnpm exec <tool>` |
| `bun.lock` / `bun.lockb` | **Bun** | `bun add <pkg>` | `bun run <script>` / `bunx <tool>` |
| `yarn.lock` | **Yarn** (any version) | `yarn add <pkg>` | `yarn <script>` |
| `package-lock.json` | **npm** | `npm install <pkg>` | `npm run <script>` / `npx <tool>` |
| `deno.lock` / `deno.json` | **Deno** | `deno add <pkg>` | `deno task <script>` / `deno run <file>` |

If only `package.json` is present with no lockfile, ask the user once which manager to assume — don't guess.

### Other ecosystems

| Lockfile / manifest | Manager | Install / add | Run |
| --- | --- | --- | --- |
| `go.sum` + `go.mod` | **Go modules** | `go get <pkg>` | `go run` / `go build` |
| `Cargo.lock` | **Cargo** | `cargo add <pkg>` | `cargo run` / `cargo build` |
| `composer.lock` | **Composer (PHP)** | `composer require <pkg>` | `composer run-script <name>` |
| `Gemfile.lock` | **Bundler (Ruby)** | `bundle add <gem>` | `bundle exec <cmd>` |
| `mix.lock` | **Mix (Elixir)** | `mix deps.get` after editing `mix.exs` | `mix <task>` |

### When the project is empty

For a greenfield project, **ask the user** which manager to use before generating any task that mentions install commands. Don't assume — picking the wrong one leaks all the way through the plan.

## Output of discovery

Produce a short internal note (don't dump it into the IA doc) that classifies every relevant component / page as one of:

- **Reuse as-is** — already exists, fits the new IA without changes. *No task needed.*
- **Modify** — exists, but needs changes (add a route, extend a layout, support a new content model). *Gets its own task.*
- **Create** — doesn't exist yet. *Gets its own task.*

Only "Modify" and "Create" become tasks in `PLAN.md`. "Reuse as-is" components are mentioned in the Component Reuse Map of `INFORMATION_ARCHITECTURE.md` but do not consume planning effort.

## When the codebase is empty

For a greenfield project there's still discovery to do — read whatever scaffolding exists (the framework's defaults, any starter template, the `package.json`). Default conventions of the chosen framework *are* part of the existing structure. Don't fight them.

## What discovery is **not**

- Not a code review. Don't comment on quality.
- Not a fix list. Bugs and tech debt go to a different document.
- Not exhaustive reading. Enumerate what's there at a structural level; don't open every file.
- Not the IA document. Discovery feeds the IA — the IA isn't a description of discovery findings.
