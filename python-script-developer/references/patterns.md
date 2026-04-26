# Python Patterns

Detailed patterns for production Python scripts. Load on demand from `SKILL.md`.

## Error handling

```python
from contextlib import contextmanager
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when input validation fails."""


def load(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.error("File not found: %s", path)
        raise
    except UnicodeDecodeError as e:
        logger.error("Cannot decode %s: %s", path, e)
        raise


@contextmanager
def acquired(resource):
    resource.acquire()
    try:
        yield resource
    finally:
        resource.release()
```

Map exceptions to distinct exit codes in `main()`:

```python
def main() -> int:
    try:
        run()
        return 0
    except FileNotFoundError as e:
        logger.error("Not found: %s", e); return 1
    except ValidationError as e:
        logger.error("Bad input: %s", e); return 2
    except PermissionError as e:
        logger.error("Permission denied: %s", e); return 3
    except KeyboardInterrupt:
        logger.warning("Interrupted"); return 130
    except Exception:
        logger.exception("Unexpected"); return 4
```

## Type hints

```python
from pathlib import Path
from typing import Optional, Union

FilePath = Union[str, Path]


def process_file(
    input_path: Path,
    output_path: Optional[Path] = None,
    encoding: str = "utf-8",
) -> bool:
    """Process a file.

    Args:
        input_path: Path to input file.
        output_path: Optional path to output file.
        encoding: File encoding.

    Returns:
        True on success.

    Raises:
        FileNotFoundError: If `input_path` does not exist.
    """
```

For Python 3.10+, prefer the built-in syntax: `int | None`, `list[str]`, `dict[str, int]`. Use `from __future__ import annotations` if you need this syntax on 3.9.

## Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("script.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

logger.debug("Detailed diagnostic info")
logger.info("Started processing %s", filename)
logger.warning("Falling back to defaults")
logger.error("Operation failed: %s", e)

# Always use logger.exception inside an `except` block — it adds the traceback:
try:
    risky()
except Exception:
    logger.exception("Risky operation failed")
```

Use `%`-style formatting (`logger.info("got %s", x)`) — it lets the logging machinery skip work when the level is filtered out.

## argparse

```python
import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Data processing tool",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    required = p.add_argument_group("required")
    required.add_argument("-i", "--input", type=Path, required=True)

    p.add_argument("-o", "--output", type=Path, default=Path("output.txt"))
    p.add_argument("--format", choices=["json", "yaml", "xml"], default="json")
    p.add_argument("-v", "--verbose", action="count", default=0,
                   help="Increase verbosity (-v, -vv)")

    sub = p.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init", help="Initialize project")
    init.add_argument("--name", required=True)

    build = sub.add_parser("build", help="Build project")
    build.add_argument("--release", action="store_true")

    return p
```

## File operations

```python
from pathlib import Path
import tempfile

# Resolve relative to the script
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG = SCRIPT_DIR / "config.yaml"

# Read
text = CONFIG.read_text(encoding="utf-8")

# Atomic write — never leaves a half-written file behind
def write_atomic(target: Path, content: str) -> None:
    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(target)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise

# Recurse for files matching a pattern
for f in (SCRIPT_DIR / "data").rglob("*.csv"):
    process(f)

# Temp file scoped to a `with`
with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json") as tmp:
    tmp.write("...")
    tmp_path = Path(tmp.name)
```

## Validation

```python
from dataclasses import dataclass, field
from typing import Any
import re


def is_email(s: str) -> bool:
    return re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s) is not None


@dataclass
class Config:
    host: str
    port: int = 8080
    timeout: float = 30.0
    tags: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.host:
            raise ValueError("host required")
        if not 1 <= self.port <= 65535:
            raise ValueError(f"invalid port: {self.port}")
```

For richer validation, use `pydantic` (third-party).

## Progress and feedback

```python
from tqdm import tqdm

for item in tqdm(items, desc="Processing", unit="item"):
    process(item)
```

For terminal color output that respects pipes and `NO_COLOR`:

```python
import os, sys

_USE_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ

def _c(code: str, msg: str) -> str:
    return f"\033[{code}m{msg}\033[0m" if _USE_COLOR else msg

def ok(msg):    return _c("92", f"✓ {msg}")
def fail(msg):  return _c("91", f"✗ {msg}")
def warn(msg):  return _c("93", f"⚠ {msg}")
```

On Windows, `colorama.init()` translates ANSI codes to the legacy console — use it if you need to support `cmd.exe`.

## Configuration

```python
import os
import json
from pathlib import Path

# Env var with default
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Required env var
def required_env(key: str) -> str:
    v = os.environ.get(key)
    if v is None:
        raise RuntimeError(f"Missing required env var: {key}")
    return v

# Load JSON
config = json.loads(Path("config.json").read_text(encoding="utf-8"))
```

For `.env` support, use `python-dotenv`. For YAML, `PyYAML`.

## Common idioms reference

| Pattern                                | Use                            |
| -------------------------------------- | ------------------------------ |
| `Path(__file__).resolve().parent`      | Script's own directory         |
| `path.read_text(encoding="utf-8")`     | Read text safely               |
| `path.write_text(s, encoding="utf-8")` | Write text                     |
| `path.glob("*.csv")` / `rglob`         | Iterate files                  |
| `path.mkdir(parents=True, exist_ok=True)` | Create directory tree       |
| `tempfile.NamedTemporaryFile`          | Scoped temp file               |
| `subprocess.run([...], check=True)`    | Run a process, raise on fail   |
| `logger.exception(...)`                | Log error + traceback          |
| `from typing import Optional`          | Nullable (or `T \| None` ≥ 3.10) |
| `dataclass(frozen=True)`               | Immutable record               |
