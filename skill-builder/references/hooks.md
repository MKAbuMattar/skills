# Auto-Suggest Hook (`task-tracker.py`)

A Claude Code [`UserPromptSubmit` hook](https://code.claude.com/docs/en/hooks) that watches the user's prompts and, when the same kind of task is asked three times, nudges Claude to propose packaging it as a reusable skill via `skill-builder`. Load this when the user wants the "ask three times → build a skill" behavior.

## What the hook does

1. On every user prompt, the hook reads the prompt from stdin (Claude Code passes a JSON payload).
2. It tokenizes the prompt (lowercase, drop punctuation, drop stopwords, drop short tokens, light stemming).
3. It compares the new token set against past prompts in `~/.claude/skill-builder-history.jsonl` using the **overlap coefficient** (`|A ∩ B| / min(|A|, |B|)`).
4. Past prompts within `TASK_TRACKER_WINDOW` days that exceed `TASK_TRACKER_THRESHOLD` similarity are counted.
5. If the count reaches `TASK_TRACKER_REPEATS - 1` (so the current prompt makes 3), it emits a `<system-reminder>` for Claude that:
   - States how many times this kind of task has come up.
   - Recommends the user invoke `skill-builder`.
   - Suggests a kebab-case **name seed** built from the most-shared tokens.
   - Tells Claude to confirm with the user before scaffolding anything.

A 30-minute cooldown prevents nagging on consecutive turns of the same cluster.

## Install (one command)

```bash
bash skill-builder/scripts/install-hook.sh
```

That writes a `UserPromptSubmit` entry into `~/.claude/settings.json` pointing at `skill-builder/scripts/task-tracker.py`. The installer:

- Backs up your existing `settings.json` to `settings.json.bak`.
- Preserves any other hooks you already have configured.
- Is **idempotent** — re-running upgrades the entry (handy after moving the repo) instead of duplicating it.

**Project scope is not recommended** — see the gotcha below. The default (user scope) is the right choice for almost everyone. If you really need project-only behavior, you can pass `--project`, but the installer will warn and the hook may be silently erased the next time Claude Code grants a permission.

To preview without writing:

```bash
bash skill-builder/scripts/install-hook.sh --dry-run
```

To remove:

```bash
bash skill-builder/scripts/install-hook.sh --uninstall
```

After installing, **restart your Claude Code session** so the new hook is picked up.

## Manual install (no installer)

If you'd rather edit `~/.claude/settings.json` by hand, add:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /absolute/path/to/skill-builder/scripts/task-tracker.py"
          }
        ]
      }
    ]
  }
}
```

Use the absolute path. Claude Code does not expand `~` or `$HOME` inside the `command` field.

## Tuning

All knobs are environment variables — set them in the hook's `command` line (e.g. `TASK_TRACKER_REPEATS=2 python3 .../task-tracker.py`) or pass `--repeats` / `--history` to `install-hook.sh`.

| Variable                  | Default                                  | Effect                                                                                                |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `TASK_TRACKER_REPEATS`    | `3`                                      | Number of similar prompts (including current) before the suggestion fires.                            |
| `TASK_TRACKER_THRESHOLD`  | `0.3`                                    | Overlap-coefficient threshold (0–1). Higher = stricter matching, fewer alerts.                        |
| `TASK_TRACKER_WINDOW`     | `30`                                     | History window in days.                                                                               |
| `TASK_TRACKER_HISTORY`    | `~/.claude/skill-builder-history.jsonl`  | Path to the prompt log. One JSON object per line.                                                     |
| `TASK_TRACKER_DEBUG`      | unset                                    | Set to `1` to write debug lines to `~/.claude/skill-builder-debug.log` (useful when calibrating).     |

### When to lower the threshold

If the hook never fires even when you're clearly asking the same kind of task, your prompts probably share fewer keywords than the heuristic expects. Lower `TASK_TRACKER_THRESHOLD` to `0.25` or `0.2` and re-run. Watch `skill-builder-debug.log` (with `TASK_TRACKER_DEBUG=1`) to see how each prompt is tokenized and what overlap each comparison produced.

### When to raise the threshold

If the hook fires on unrelated prompts that happen to share a few words, raise to `0.4` or `0.5` — `0.5` requires at least half of the smaller token set to overlap, which catches "deploy a service to k8s" and "deploy a different service to k8s" but excludes loose paraphrases.

### When to lower `REPEATS` to `2`

Set `TASK_TRACKER_REPEATS=2` if you want the suggestion *the second* time you hit a recurring task — useful while you're actively curating skills. Bump back to `3` for a quieter default.

## Test the hook standalone

The hook runs against stdin, so you can exercise it without involving Claude Code:

```bash
# Pretend three similar prompts arrive.
echo '{"prompt":"write me a make target that runs terraform plan with logging"}' \
  | python3 skill-builder/scripts/task-tracker.py

echo '{"prompt":"give me a Makefile target for terraform plan that logs output"}' \
  | python3 skill-builder/scripts/task-tracker.py

echo '{"prompt":"add a make target to log terraform plan to a file"}' \
  | python3 skill-builder/scripts/task-tracker.py
# ↑ This third call prints the <system-reminder> to stdout.
```

Wipe history between trials:

```bash
rm -f ~/.claude/skill-builder-history.jsonl
```

## Troubleshooting

- **Hook seems to never fire.** Restart your Claude session after installing — Claude Code loads `settings.json` once at session start. Then run with `TASK_TRACKER_DEBUG=1` and inspect `~/.claude/skill-builder-debug.log` to confirm the hook is being invoked.
- **Hook fires too often.** Raise `TASK_TRACKER_THRESHOLD` toward `0.4` or `0.5`, or set `TASK_TRACKER_REPEATS=4`.
- **History file ballooned.** The hook auto-rotates after 5,000 lines, but you can reset any time with `rm ~/.claude/skill-builder-history.jsonl`.
- **`python3 not found in PATH`.** The installer requires Python 3.9+. Install it from your package manager (or use [uv](https://docs.astral.sh/uv/) and edit the `command` to `uv run --python 3.12 ...`).
- **Hook crashed mid-prompt.** It catches all exceptions and exits 0 silently (so it never blocks you). Set `TASK_TRACKER_DEBUG=1` to see the traceback in the debug log.

### Gotcha: project-scope hook erased after a permission auto-grant

If you install with `--project`, Claude Code may **overwrite** `./.claude/settings.local.json` whenever it auto-grants a new `Bash(...)` / `WebFetch(...)` permission inside the running session — and current versions of Claude Code don't always preserve top-level keys it doesn't manage (like `hooks`). Symptom: the `hooks` block disappears even though `permissions.allow` keeps growing.

**Use user scope.** Run `bash skill-builder/scripts/install-hook.sh` with no flags. That writes to `~/.claude/settings.json`, which Claude Code does *not* auto-rewrite, so the hook persists indefinitely. This is the only reliable path; `--project` exists only for advanced cases where you accept the wipe risk.

### Gotcha: hooks load once per session, not per turn

Claude Code reads `~/.claude/settings.json` (and project settings) **at session start**. Installing the hook mid-session does not make it fire on the *next* prompt of that session — it'll only fire in a fresh session.

**For the current session, that's fine** — `skill-builder`'s SKILL.md has a *Self-monitor mode* section telling Claude to track recurring tasks from conversation context and propose packaging once a pattern emerges. The skill produces the same suggestion the hook would, even before the hook is active.

**For future sessions**, the hook does the same job automatically across whole-session boundaries (it remembers prompts in `~/.claude/skill-builder-history.jsonl`). The two mechanisms are complementary: self-monitor catches in-session patterns, the hook catches longer-running ones across sessions.

## What gets logged

Each line in `~/.claude/skill-builder-history.jsonl` is a JSON object:

```json
{"ts": 1745673421.12, "prompt": "...", "tokens": ["..."]}
```

Plus an alert anchor whenever a suggestion fires:

```json
{"ts": ..., "alerted_ts": ..., "prompt": "...", "tokens": [...], "marker": "alert"}
```

The file is **plain text on disk**. Don't enable the hook on a shared machine if your prompts contain secrets. Add `TASK_TRACKER_HISTORY=/dev/null` to disable persistence entirely (the hook just won't ever match).
