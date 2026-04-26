# Python Anti-Patterns

Load this when reviewing or refactoring an existing script, or before finalizing one you wrote.

## 1. No type hints

```python
# BAD — caller has to read the body to know the contract
def process(data, config):
    return data.get(config.key)

# GOOD
def process(data: dict[str, Any], config: Config) -> str | None:
    return data.get(config.key)
```

`mypy` only finds bugs when the signatures are typed.

## 2. Bare `except` / swallowing

```python
# BAD — masks bugs, including KeyboardInterrupt and SystemExit
try:
    operation()
except:
    pass

# GOOD — name the exception, log the failure
try:
    operation()
except FileNotFoundError as e:
    logger.error("File missing: %s", e)
    return 1
```

The only legitimate use of `except Exception:` is at the top of `main()`, paired with `logger.exception(...)`.

## 3. `os.path` instead of `pathlib`

```python
# BAD
import os
config = os.path.join(os.path.dirname(__file__), "config.yaml")
if os.path.exists(config):
    with open(config) as f:
        text = f.read()

# GOOD
from pathlib import Path
config = Path(__file__).resolve().parent / "config.yaml"
if config.exists():
    text = config.read_text(encoding="utf-8")
```

## 4. No `__main__` guard

```python
# BAD — runs on import
parser = argparse.ArgumentParser()
args = parser.parse_args()
main(args)

# GOOD
def main() -> int:
    args = build_parser().parse_args()
    ...
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

Without the guard, importing the module for testing crashes immediately on `parse_args`.

## 5. `print` for diagnostics

```python
# BAD — pollutes stdout, can't be silenced or filtered
print(f"Loading {filename}")
print(f"ERROR: {e}")

# GOOD
logger.info("Loading %s", filename)
logger.error("Operation failed: %s", e)
```

`print` is reserved for the script's actual *output* — the structured data the caller will pipe or parse.

## 6. Missing docstrings on public functions

```python
# BAD — what does this raise? what's the return shape?
def process(data, config):
    return data[config.key]

# GOOD
def process(data: dict[str, Any], config: Config) -> Any:
    """Process data using configuration.

    Args:
        data: Input data dictionary.
        config: Configuration object.

    Returns:
        Value at `config.key`.

    Raises:
        KeyError: If `config.key` not in `data`.
    """
    return data[config.key]
```

## 7. Hardcoded values

```python
# BAD
def connect():
    return Database("localhost", 5432, "mydb")

# GOOD — defaults from env, overridable from args
import os

def connect(
    host: str | None = None,
    port: int = 5432,
    database: str | None = None,
) -> Database:
    return Database(
        host or os.environ.get("DB_HOST", "localhost"),
        port,
        database or os.environ.get("DB_NAME", "mydb"),
    )
```

## 8. Manual `sys.argv` parsing

```python
# BAD
if len(sys.argv) < 2:
    print("usage: ...")
    sys.exit(1)
input_file = sys.argv[1]

# GOOD
parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
args = parser.parse_args()
```

## 9. Not using context managers

```python
# BAD — file leak on exception
f = open(path)
data = f.read()
f.close()

# GOOD
with path.open() as f:       # or path.read_text()
    data = f.read()
```

Same for locks, sockets, database cursors, `tempfile.NamedTemporaryFile`.

## 10. Mutable default arguments

```python
# BAD — the default list is shared across all calls
def add(item, items=[]):
    items.append(item)
    return items

# GOOD
def add(item, items: list | None = None) -> list:
    items = list(items) if items else []
    items.append(item)
    return items
```

## 11. String concat for paths or commands

```python
# BAD — breaks on Windows; vulnerable to injection
path = base + "/" + filename
os.system(f"rm {user_input}")

# GOOD
path = Path(base) / filename
subprocess.run(["rm", user_input], check=True)  # arg list, not shell=True
```

Never use `shell=True` with user-controlled strings.

## 12. Top-level work on import

```python
# BAD — module imports cost seconds because of this
DATA = expensive_query()

# GOOD — defer until called, optionally cache
from functools import lru_cache

@lru_cache(maxsize=1)
def get_data():
    return expensive_query()
```
