# Agent Skills

A collection of [agent skills](https://agentskills.io) for writing production-ready scripts and authoring more skills. MIT-licensed, works in any [skills-compatible client](https://agentskills.io/clients) (Claude Code, Cursor, GitHub Copilot, OpenAI Codex, Gemini CLI, and others).

## Scripting

Production-ready scripts with proper error handling, validated input, and cross-platform support.

- **linux-script-developer** — Write production-ready Bash scripts with strict mode (`set -euo pipefail`), validated arguments, colored feedback, and cross-platform support (Linux, macOS, Windows via Git Bash/WSL).

  ```
  npx skills@latest add MKAbuMattar/skills/linux-script-developer
  ```

- **python-script-developer** — Write production-ready Python CLI tools and automation scripts with type hints, structured logging, `argparse`, `pathlib`, and specific exception handling.

  ```
  npx skills@latest add MKAbuMattar/skills/python-script-developer
  ```

- **javascript-script-developer** — Write production-ready Node.js CLI tools and automation scripts in modern JavaScript — ESM by default, argument parsing via the built-in `node:util` `parseArgs`, structured stderr logging, `node:fs/promises`, specific Error subclasses for distinct failure modes, top-level await, graceful SIGINT/SIGTERM handling, and cross-platform support. Targets Node.js 20 LTS+; mentions Bun and Deno as alternative runtimes.

  ```
  npx skills@latest add MKAbuMattar/skills/javascript-script-developer
  ```

- **typescript-script-developer** — Write production-ready TypeScript CLI tools with strict type-checking — TypeScript 5.x with strict mode tsconfig (incl. `noUncheckedIndexedAccess` and `verbatimModuleSyntax`), ESM, type-safe argv via `parseArgs`, discriminated-union error classes with exhaustiveness checks via `assertNever`, branded types where useful, `unknown` in catch blocks. Run via tsx (default), Bun, or Deno; build for distribution with `tsc`. Targets Node.js 20 LTS+ and TypeScript 5.4+.

  ```
  npx skills@latest add MKAbuMattar/skills/typescript-script-developer
  ```

- **golang-script-developer** — Write production-ready Go CLI tools with idiomatic patterns — Go modules layout, the standard library `flag` package by default (cobra/urfave-cli for complex CLIs), structured logging via `log/slog`, error wrapping with `fmt.Errorf %w` plus `errors.Is`/`errors.As`, `context.Context` for cancellation, `signal.NotifyContext` for graceful SIGINT/SIGTERM, distinct exit codes via typed `*exitError`, embedded assets via `//go:embed`, `errgroup` for concurrency, and cross-compile single-binary support (GOOS/GOARCH). Targets Go 1.22+.

  ```
  npx skills@latest add MKAbuMattar/skills/golang-script-developer
  ```

- **makefile-script-developer** — Write production-ready GNU Makefiles with strict shell mode (`SHELL := /bin/bash` + `.SHELLFLAGS := -euo pipefail -c`), validated multi-environment configuration, pre-flight check targets, structured logging, confirmation gates for destructive ops, and self-documenting help. Includes templates for simple build/test, Terraform multi-env, Helm deploy/recover, chart packaging, and cross-platform binary builds.

  ```
  npx skills@latest add MKAbuMattar/skills/makefile-script-developer
  ```

## Authoring

Tools for building more skills.

- **skill-builder** — Build new Agent Skills that follow the agentskills.io spec and best practices: slim `SKILL.md` (≤ 200 lines), progressive disclosure via `references/`, bundled `assets/` and `scripts/`, MIT `LICENSE`. Ships a one-command scaffolder, a spec-compliance validator, and an auto-suggest hook for recurring tasks.

  ```
  npx skills@latest add MKAbuMattar/skills/skill-builder
  ```

- **generic-by-design** — Scrub a skill, template, README, code repo, or any artifact for **organization-specific fingerprints** — internal cloud regions, branded SaaS products asserted as the user's stack, proprietary cloud-service abbreviations, hardcoded vendor URLs, source-skill author attributions, concept-author attributions (`<author>'s <concept>` patterns), org / company names, internal filesystem paths, stack-specific assertions (`"our setup uses X"`), and hardcoded scale fingerprints. Replaces each with a generic placeholder (`<vendor-saas>`, `<cloud-region>`, `registry.example.com`), role name, or multi-option illustrative list. Ships a `scan-fingerprints.sh` script that catches ~10 categories with line-numbered reports, **wordlists in `scripts/data/*.txt`** (tool data, separate from skill content — users add their own fork-source authors / org names / stack), a pattern catalog with placeholder-shaped examples, a keep-vs-mask decision matrix, RFC-2606 / RFC-5737 placeholder conventions, and synthetic worked before/after examples (Acme / Cumulus / Bastion / FrontEdge — no real vendors). Use whenever you see "generic-by-design okay", "scrub the proprietary refs", or "anonymize this template". The skill itself contains zero real vendor / author / region names.

  ```
  npx skills@latest add MKAbuMattar/skills/generic-by-design
  ```

## Repo Hygiene

- **pre-commit-setup** — Wire **cross-language pre-commit hooks** into any git repository. Detects which languages the repo uses (Node.js / TypeScript, Python, PHP, Java, Go, Rust, Ruby, Shell, Terraform, Markdown) and configures the right formatter / linter / type-checker per language via the universal `pre-commit` framework. Always adds universal hygiene (whitespace, EOF, large-file detection, merge-conflict markers, JSON/YAML/TOML validation), secret scanning (gitleaks), and Conventional Commits enforcement (commitizen / commitlint / regex fallback). Optional **Husky + lint-staged + Prettier** track for pure-Node repos. Ships templates for kitchen-sink and minimal configs, a `detect-languages.sh` script, and a worked polyglot example.

  ```
  npx skills@latest add MKAbuMattar/skills/pre-commit-setup
  ```

## QA & Issue Tracking

- **qa** — Run an interactive QA session: capture user-described bugs, ask brief clarifying questions, explore the codebase for domain context, decide single-vs-breakdown, and file durable user-focused GitHub issues via `gh issue create` — without referencing internal file paths or line numbers. Ships ready-to-fill single-issue and breakdown-subissue body templates.

  ```
  npx skills@latest add MKAbuMattar/skills/qa
  ```

## CI/CD & Release

- **gitops-pipeline-developer** — Author production-ready GitOps release pipelines (Jenkins-style by default; portable patterns for GitHub Actions, GitLab CI, Drone) that combine Gitflow branching, Conventional Commits, automatic SemVer bumping, a SonarQube quality gate, Grype container image scanning, and an aggregated quality+security **scorecard with policy alignment checks**. Includes a runnable `compute-score.sh` that turns Sonar + Grype JSON into a 0–100 score plus pass/fail policy alignments.

  ```
  npx skills@latest add MKAbuMattar/skills/gitops-pipeline-developer
  ```

- **gitops-cd-developer** — Author production GitOps CD setups: the **App-of-Apps pattern** (ArgoCD or Flux) where a root Application spawns N child Applications that auto-sync, self-heal, and prune; a **shareable runtime-agnostic Helm chart** (Node.js / PHP / Java / static) consumers depend on; **multi-environment values** (dev / staging / prod / multi-instance / multi-region); and **progressive deployment** strategies (RollingUpdate / Recreate / blue-green / canary via Argo Rollouts). Pairs with `gitops-pipeline-developer` (CI half).

  ```
  npx skills@latest add MKAbuMattar/skills/gitops-cd-developer
  ```

## Infrastructure as Code

- **terraform-module-developer** — Build production-ready, multi-provider Terraform modules with a strict **8-file structure** (4 root + 4 `wrappers/`) — typed variables prefixed with the resource name, count-conditional resources, dynamic blocks with iterator pattern, outputs using `try/element/concat`, full heredoc provider docs, and a wrapper module supporting batch ops via `for_each`. Generates a polished `README.md` with `BEGIN_TF_DOCS / END_TF_DOCS` markers so **terraform-docs** auto-injects requirements / providers / inputs / outputs / resources tables. Bundles a generic `.terraform-docs.yml`, `.tflint.hcl`, pre-commit fragment, security scanning (**tflint + tfsec/trivy + checkov**) and module testing patterns (Terraform 1.6+ `*.tftest.hcl` + `examples/` directory). Works with any Terraform provider — AWS, Azure, GCP, HuaweiCloud, OCI, DigitalOcean, Cloudflare, and community providers. Ships a multi-provider `scaffold-module.sh`, a 14-check `validate-module.sh`, and a `setup-tooling.sh` that installs the whole toolchain.

  ```
  npx skills@latest add MKAbuMattar/skills/terraform-module-developer
  ```

## Planning & Architecture

- **information-architecture** — Plan the structural and execution architecture of a feature, app, or site. Produces both an `INFORMATION_ARCHITECTURE.md` (sitemap, navigation, content hierarchy, user flows, URL strategy, naming conventions, component reuse map) **and** a phased `PLAN.md` (phases by impact × effort × risk, vertical-slice tasks with sub-tasks, dependencies, estimates, and a detailed task breakdown with Why · How · Impact · Effort). Includes a discovery checklist, phasing guide, task-slicing rules, both templates, and a fully-worked example.

  ```
  npx skills@latest add MKAbuMattar/skills/information-architecture
  ```

- **deep-discovery** — Run a rigorous **100-question self-interrogation** that exhaustively stress-tests an idea, design, architecture, plan, strategy, product, business idea, trading system, patch, or skill/plugin proposal before committing. Each question builds on the previous answer; phases run from foundation → mechanics → stress testing → competitive analysis → feasibility → refinement → synthesis. Supports **evaluation / exploration / comparison** modes and routes to one of six domain patterns (software architecture, code review, skill-and-plugin creation, business/product, trading/financial, general). Output is a brutally honest synthesis: top issues, top strengths, recommended changes, revised proposal, bottom-line verdict.

  ```
  npx skills@latest add MKAbuMattar/skills/deep-discovery
  ```

- **plan-interview** — Interactive complement to `deep-discovery`. Interview the user **one question at a time, branch-by-branch**, until every decision in their plan or design is resolved. Each question ships with a **recommended answer and short rationale**, so the user reacts instead of generating from scratch. Builds and updates a decision tree across turns; sequences questions by dependency (high-leverage first); resolves anything answerable from the codebase by reading code instead of asking. Stops when the tree is empty or the user calls "stop".

  ```
  npx skills@latest add MKAbuMattar/skills/plan-interview
  ```

- **architecture-audit** — Audit an existing codebase for **shallow modules** and surface **deepening opportunities** — refactors that turn shallow modules into deep ones by relocating their seams. Walks the codebase looking for friction signals (scattered concepts, leaky non-seams, testability theater, single-adapter "ports"), applies the **deletion test** to every candidate, and presents a numbered list with `Files / Problem / Deletion-test / Solution / Dependency-category / Benefits / Risks / ADR-conflict`. Then walks the user through the picked candidate one question at a time, with optional **parallel sub-agent fanout** for "Design It Twice"-style interface exploration. Uses a strict 7-term vocabulary (Module · Interface · Implementation · Depth · Seam · Adapter · Leverage · Locality) and the `replace, don't layer` testing strategy.

  ```
  npx skills@latest add MKAbuMattar/skills/architecture-audit
  ```

## Presentations

- **interactive-deck-builder** — Build interactive HTML presentations on **any topic** — sales pitches, conference talks, classroom lectures, product demos, scientific visualizations, story telling, training material. Each concept can become a Three.js scene (race, particle-flow, click-to-destroy, scale-up-down, force-directed graph, multi-stage flow, wave generator, color-shift slider, comparison split-screen, and more). Ships a slim slide-controller framework, a dark design system with mood-driven section accent colors, a CLI / REPL / terminal playback simulator (kubectl / psql / git / npm / any scripted CLI), pluggable live-data discovery (CSV / JSON / API / SQL / file scan / kubectl), a fullscreen-scene toggle that collapses panels into a bottom bar, and an auto-generated speaker guide. The framework is topic-agnostic — bring your own metaphor, your own data source, your own scenes. Pairs with complementary skills for Three.js fundamentals, presentation content, slide design, and outline / pitch-deck structure.

  ```
  npx skills@latest add MKAbuMattar/skills/interactive-deck-builder
  ```

## Writing & Editing

- **humanizer** — Edit or review text to remove signs of AI-generated writing. Catches all 29 patterns from Wikipedia's "Signs of AI writing" guide (significance inflation, promotional language, superficial -ing analyses, vague attributions, em-dash overuse, rule-of-three, AI vocabulary, copula avoidance, negative parallelisms, sycophantic openings, and more). Runs the full draft → audit → final loop (asks "what makes this so obviously AI generated?" and revises until the answer is honest). Supports voice calibration when given a writing sample.

  ```
  npx skills@latest add MKAbuMattar/skills/humanizer
  ```

## Manual install

If you prefer not to use the `skills` CLI, clone and symlink:

```bash
git clone https://github.com/MKAbuMattar/skills.git
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/linux-script-developer"    ~/.claude/skills/
ln -s "$PWD/skills/python-script-developer"   ~/.claude/skills/
ln -s "$PWD/skills/javascript-script-developer" ~/.claude/skills/
ln -s "$PWD/skills/typescript-script-developer" ~/.claude/skills/
ln -s "$PWD/skills/golang-script-developer"   ~/.claude/skills/
ln -s "$PWD/skills/makefile-script-developer" ~/.claude/skills/
ln -s "$PWD/skills/skill-builder"             ~/.claude/skills/
ln -s "$PWD/skills/generic-by-design"         ~/.claude/skills/
ln -s "$PWD/skills/qa"                        ~/.claude/skills/
ln -s "$PWD/skills/information-architecture"  ~/.claude/skills/
ln -s "$PWD/skills/gitops-pipeline-developer" ~/.claude/skills/
ln -s "$PWD/skills/gitops-cd-developer"       ~/.claude/skills/
ln -s "$PWD/skills/humanizer"                 ~/.claude/skills/
ln -s "$PWD/skills/deep-discovery"            ~/.claude/skills/
ln -s "$PWD/skills/plan-interview"            ~/.claude/skills/
ln -s "$PWD/skills/pre-commit-setup"          ~/.claude/skills/
ln -s "$PWD/skills/architecture-audit"        ~/.claude/skills/
ln -s "$PWD/skills/terraform-module-developer" ~/.claude/skills/
ln -s "$PWD/skills/interactive-deck-builder" ~/.claude/skills/
```

For other clients, see each tool's skill discovery path in the [client showcase](https://agentskills.io/clients).

## Contributing

PRs welcome. New skills must follow the [Agent Skills spec](https://agentskills.io/specification) — slim `SKILL.md` (under 200 lines), detail in `references/`, templates in `assets/`, MIT-licensed.

The fastest path:

```bash
bash skill-builder/scripts/new-skill.sh my-new-skill "Imperative description with casual phrasings the user might type..."
bash skill-builder/scripts/validate-skill.sh ./my-new-skill   # aim for 100%
```

## License

[MIT](LICENSE) © Mohammad Abu Mattar.
