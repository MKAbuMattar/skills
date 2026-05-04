---
name: python-script-developer
description: Write production-ready Python CLI tools, automation scripts, and batch file processors with type hints, structured `logging` (never `print` for diagnostics), `argparse` interfaces, `pathlib` for filesystem work, specific exception handling, and cross-platform support (Linux, macOS, Windows). Use this skill whenever the user asks to create a Python script, `.py` utility, CLI tool, automation, batch processor, or data pipeline — including casual phrasings like "write a python script that ...", "automate this in python", "I need a small tool", or "give me a one-off processor". Also use when reviewing or hardening an existing Python script.
license: MIT. See LICENSE for full terms.
compatibility: Python 3.9+ on Linux, macOS, or Windows. Generated scripts target the same range.
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# Python Script Developer

Production-ready Python. Type-hinted + logged + argparsed + pathlib + specific exceptions.

## When to use

- The user asks for any `.py` script, CLI tool, automation, or batch processor.
- The user wants to harden, refactor, or review an existing Python script.
- A task chain ends in "and put it in a python script".

## Required structure

Every script you write starts from this skeleton. Do not omit type hints, the `if __name__ == '__main__'` guard, or the `sys.exit(main())` pattern.

```python
#!/usr/bin/env python3
"""<one-line description>.

<longer description if needed>
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", type=Path, help="Input file path")
    p.add_argument("-o", "--output", type=Path, help="Output file path")
    p.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    try:
        # logic here
        return 0
    except FileNotFoundError as e:
        logger.error("File not found: %s", e)
        return 1
    except Exception:
        logger.exception("Unexpected error")
        return 2


if __name__ == "__main__":
    sys.exit(main())
```

## Workflow

1. **Confirm the package manager.** If the script imports anything outside the standard library, install commands must use the user's preferred manager. See `references/package-managers.md` — read it on the first run to capture the preference, then save it to user memory so future runs skip the question.
2. **Pick a starting template** from `assets/templates/`:
   - `script.template.py` — basic single-purpose script.
   - `cli-tool.template.py` — multi-subcommand CLI.
   - `file-processor.template.py` — batch processing.
3. **Apply patterns** from `references/patterns.md` for any non-obvious case (custom exceptions, dataclass validation, subcommands, structured logging, progress bars).
4. **Validate the result.** Run `python3 scripts/validate-script.py <your-script.py>` — it AST-parses the script and checks shebang, docstrings, type hints, main guard, logging, pathlib, argparse, and error handling. Aim for 100%.
5. **Cross-check `references/anti-patterns.md`** — especially `os.path` vs `pathlib`, bare `except`, missing `__main__` guard, and hardcoded values.
6. **For cross-platform scripts**, load `references/cross-platform.md` and apply the rules (signals, paths, console colors, executable suffixes).
7. **Generate man-page-style docs** using the template in `references/documentation.md` — either inline or as `<script>.md` next to the file.

## Available resources

- `assets/templates/{script,cli-tool,file-processor}.template.py` — starting points.
- `assets/examples/csv-analyzer.py` — full-featured reference implementation.
- `scripts/validate-script.py` — score a script against the checklist (run after writing).
- `references/patterns.md` — load when implementing argparse/logging/error/file/dataclass patterns.
- `references/anti-patterns.md` — load when reviewing or rewriting an existing script.
- `references/cross-platform.md` — load when targeting macOS or Windows alongside Linux.
- `references/documentation.md` — load when generating script reference docs.
- `references/package-managers.md` — load on first run to capture the user's preferred installer.

## Top gotchas (always inline — do not skip)

- **`pathlib.Path`, never `os.path`.** `Path(__file__).resolve().parent / "config.yaml"`, not `os.path.join(...)`.
- **`logging`, never `print`** for diagnostics. `print` is only for the script's structured _output_.
- **No bare `except:`.** Always catch a specific exception. Use `except Exception:` only at the very top of `main()` with `logger.exception(...)`.
- **`argparse`, never raw `sys.argv`** parsing.
- **`if __name__ == "__main__": sys.exit(main())`** — return exit codes from `main()` instead of calling `sys.exit` from anywhere inside.
- **Always add type hints** to function signatures (`def f(x: int) -> str:`). They double as documentation and let `mypy` find bugs.
- **`with` for every file/lock/socket** — no manual `f.close()`.
- **Atomic writes:** write to `tmp.with_suffix(".tmp")` then `Path.replace(target)` so partial writes can't corrupt the destination.

## What you DO

1. Start every script from `assets/templates/`.
2. Add type hints to every function (args and return).
3. Use `argparse` with explicit `type=Path` for file/directory args.
4. Use `logging` at module scope; let `--verbose` flip the level to `DEBUG`.
5. Use `pathlib.Path` for all filesystem work.
6. Catch specific exceptions and map them to distinct exit codes (1 = generic, 2 = bad input, 3 = permission, 130 = SIGINT, etc.).
7. Use Google-style or NumPy-style docstrings on public functions.
8. Use context managers (`with`) for files, locks, sockets, temp files.
9. Show progress with `tqdm` for any loop that may take more than a couple of seconds.
10. Run `scripts/validate-script.py` on the result; iterate until ≥ 90%.
11. Generate man-page-style reference docs (`references/documentation.md`).

## What you do NOT do

- Use `os.path`, `os.system`, `os.popen`, or string-concatenated paths.
- Use bare `except:` or swallow exceptions with `pass`.
- Print debug info — use `logger.debug(...)`.
- Hardcode values that should come from env vars, config, or args.
- Write top-level execution code without a `__main__` guard.
- Skip docstrings on public functions.
- Use deprecated stdlib (`optparse`, `imp`) or unpinned third-party deps.
