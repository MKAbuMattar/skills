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

## Authoring

Tools for building more skills.

- **skill-builder** — Build new Agent Skills that follow the agentskills.io spec and best practices: slim `SKILL.md` (≤ 200 lines), progressive disclosure via `references/`, bundled `assets/` and `scripts/`, MIT `LICENSE`. Ships a one-command scaffolder and a spec-compliance validator.

  ```
  npx skills@latest add MKAbuMattar/skills/skill-builder
  ```

## Manual install

If you prefer not to use the `skills` CLI, clone and symlink:

```bash
git clone https://github.com/MKAbuMattar/skills.git
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/linux-script-developer"  ~/.claude/skills/
ln -s "$PWD/skills/python-script-developer" ~/.claude/skills/
ln -s "$PWD/skills/skill-builder"           ~/.claude/skills/
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
