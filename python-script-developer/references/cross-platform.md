# Cross-Platform Python

Load this when the script will run on more than one OS. Python is fairly portable, but a handful of areas (paths, signals, console colors, executable names, line endings) need explicit care.

## OS detection

```python
import platform


def detect_os() -> str:
    s = platform.system().lower()
    if s == "darwin":
        return "macos"
    if s in ("linux", "windows"):
        return s
    return "unknown"


OS = detect_os()
```

## Compatibility rules

| Concern             | Rule                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Shebang             | `#!/usr/bin/env python3` — never hardcode a Python path                                      |
| Paths               | Always `pathlib.Path`. Never string-concat with `/` or `\\`.                                 |
| Path separators     | Don't hardcode either; `pathlib` handles them.                                               |
| Encoding            | Always pass `encoding="utf-8"` explicitly to `open()`, `read_text()`, `write_text()`.        |
| Line endings        | Use `newline=""` when writing CSV with the `csv` module.                                     |
| Temp dir            | `tempfile.gettempdir()` — never hardcode `/tmp`.                                             |
| Home dir            | `Path.home()` — never `~` or `$HOME`.                                                        |
| Config / cache dir  | Use `platformdirs` (third-party) for OS-correct config/cache/data paths.                     |
| File permissions    | Avoid `os.chmod()` with Unix-only modes. Use `stat` constants. Windows ignores most modes.   |
| Subprocess          | `subprocess.run([...], check=True, shell=False)`. Adjust executable names per OS.            |
| Executables         | `shutil.which("git")` finds `git` or `git.exe` correctly.                                    |
| Signals             | `SIGTERM` / `SIGHUP` don't exist on Windows. Guard with `hasattr(signal, "SIGTERM")`.        |
| Console colors      | Check `sys.stdout.isatty()` and respect `NO_COLOR`. On Windows, `colorama.init()` if needed. |
| Newlines in text    | Use `"\n"` for portable text files. Use `os.linesep` only for OS-native output.              |

## OS-specific paths

```python
from pathlib import Path
import platform


def config_dir(app: str) -> Path:
    sys = platform.system().lower()
    if sys == "linux":
        return Path.home() / ".config" / app
    if sys == "darwin":
        return Path.home() / "Library" / "Application Support" / app
    if sys == "windows":
        return Path.home() / "AppData" / "Roaming" / app
    return Path.home() / f".{app}"


cfg = config_dir("myapp")
cfg.mkdir(parents=True, exist_ok=True)
```

The third-party `platformdirs` package does this correctly for every OS, including XDG variables on Linux. Prefer it for any non-trivial use case.

## Signals

```python
import signal


def install_handler():
    handler = lambda signum, frame: shutdown()
    signal.signal(signal.SIGINT, handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handler)
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, handler)
```

## Subprocess with cross-platform executable

```python
import shutil
import subprocess


def run_git(*args: str) -> subprocess.CompletedProcess:
    git = shutil.which("git")
    if git is None:
        raise RuntimeError("git not found in PATH")
    return subprocess.run([git, *args], check=True, capture_output=True, text=True)
```

## CSV writing with proper newlines

```python
import csv
from pathlib import Path

with Path("out.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["name", "value"])
```

Without `newline=""`, Windows writes `\r\r\n` line endings.
