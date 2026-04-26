# Preferred Package Manager

Load this on the first run of a session that requires non-stdlib packages.

## Behavior

1. Check if a package manager preference is already saved in user memory.
2. If not, ask the user once which they prefer:
   - **`uv`** — fast Rust-based installer (`uv pip install <pkg>` or `uv add` for projects)
   - **`pip`** — standard pip (`pip install <pkg>`)
   - **`poetry`** — `pyproject.toml`-based (`poetry add <pkg>`)
   - **`pipenv`** — `Pipfile`-based (`pipenv install <pkg>`)
   - **`conda`** — Anaconda/Miniconda (`conda install <pkg>`)
   - **`pdm`** — PEP 582 / `pyproject.toml` (`pdm add <pkg>`)
3. Save the answer to user memory so future sessions skip the question.
4. Use the chosen manager's syntax in every install command, README snippet, comment, and `# Prerequisites` block of generated scripts.

## Install commands

| Manager  | Install single package    | Run a one-off tool       |
| -------- | ------------------------- | ------------------------ |
| `uv`     | `uv pip install <pkg>`    | `uvx <tool>`             |
| `pip`    | `pip install <pkg>`       | `pipx run <tool>`        |
| `poetry` | `poetry add <pkg>`        | `poetry run <tool>`      |
| `pipenv` | `pipenv install <pkg>`    | `pipenv run <tool>`      |
| `conda`  | `conda install <pkg>`     | n/a                      |
| `pdm`    | `pdm add <pkg>`           | `pdm run <tool>`         |

## Default

If the user has no preference recorded and declines to choose, default to **`uv`** — it's fast, reproducible, and a near-drop-in replacement for `pip`.

## Inline-dependency scripts (PEP 723)

For one-off scripts that should declare their own dependencies, use PEP 723 metadata so any modern installer (`uv run`, `pipx run`) can run them with no setup:

```python
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "tqdm>=4.65,<5",
#   "pyyaml>=6.0",
# ]
# ///
"""My self-contained script."""
```

Run it with:

```bash
uv run scripts/my_script.py     # or: pipx run scripts/my_script.py
```

This is the preferred approach for skill-bundled scripts in `scripts/` — it removes the install step entirely.
