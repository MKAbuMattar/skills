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

## Planning & Architecture

- **information-architecture** — Plan the structural and execution architecture of a feature, app, or site. Produces both an `INFORMATION_ARCHITECTURE.md` (sitemap, navigation, content hierarchy, user flows, URL strategy, naming conventions, component reuse map) **and** a phased `PLAN.md` (phases by impact × effort × risk, vertical-slice tasks with sub-tasks, dependencies, estimates, and a detailed task breakdown with Why · How · Impact · Effort). Includes a discovery checklist, phasing guide, task-slicing rules, both templates, and a fully-worked example.

  ```
  npx skills@latest add MKAbuMattar/skills/information-architecture
  ```

## Manual install

If you prefer not to use the `skills` CLI, clone and symlink:

```bash
git clone https://github.com/MKAbuMattar/skills.git
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/linux-script-developer"    ~/.claude/skills/
ln -s "$PWD/skills/python-script-developer"   ~/.claude/skills/
ln -s "$PWD/skills/makefile-script-developer" ~/.claude/skills/
ln -s "$PWD/skills/skill-builder"             ~/.claude/skills/
ln -s "$PWD/skills/qa"                        ~/.claude/skills/
ln -s "$PWD/skills/information-architecture"  ~/.claude/skills/
ln -s "$PWD/skills/gitops-pipeline-developer" ~/.claude/skills/
ln -s "$PWD/skills/gitops-cd-developer"       ~/.claude/skills/
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
