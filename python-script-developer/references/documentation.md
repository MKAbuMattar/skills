# Reference Documentation Template

Every script needs accompanying man-page-style reference documentation — either inline as a markdown block at the top of the module, or as a sibling `<script-name>.md`.

## Rules

1. **Always generate** when creating a new script.
2. **Keep in sync** when the script changes.
3. **No placeholders** — fill every section. No `TODO`, `TBD`, or `<...>` left behind.
4. **Platform table is mandatory** — list Windows, macOS, and Linux explicitly with Python version constraints.
5. **Examples must show cross-platform invocation** — `python3 script.py` (Linux/macOS) and `python script.py` / `py script.py` (Windows).
6. **Prerequisites use the user's preferred package manager** — see `package-managers.md`.

## Template

````markdown
# <script-name>

## Description

<One or two paragraphs explaining what the script does, when to use it, and what
problem it solves.>

## Synopsis

```
python <script-name>.py [OPTIONS] <required-args>
```

## Options

| Option            | Type   | Required | Default      | Description                  |
| ----------------- | ------ | -------- | ------------ | ---------------------------- |
| `-h`, `--help`    | flag   | No       | —            | Show help message and exit   |
| `-v`, `--verbose` | flag   | No       | —            | Enable verbose/debug output  |
| `-o`, `--output`  | string | No       | `output.txt` | Output file path             |
| `<input>`         | string | Yes      | —            | Input file or directory path |

## Supported Platforms

| Platform              | Supported | Python Version | Notes                                    |
| --------------------- | --------- | -------------- | ---------------------------------------- |
| Linux (Ubuntu/Debian) | Yes       | 3.9+           |                                          |
| Linux (RHEL/Fedora)   | Yes       | 3.9+           |                                          |
| macOS                 | Yes       | 3.9+           | Use `python3` (system Python may be old) |
| Windows 10/11         | Yes       | 3.9+           | Use `python` or the `py` launcher        |
| Windows (WSL)         | Yes       | 3.9+           |                                          |

## Prerequisites

- Python 3.9 or later
- Required packages (install with the preferred package manager — see `references/package-managers.md`):
  ```bash
  <pkg-manager-install-command> <package1> <package2>
  ```

## Examples

### Basic usage

```bash
# Linux / macOS
python3 script.py input.txt

# Windows
python script.py input.txt
# or
py script.py input.txt
```

### With options

```bash
python3 script.py --verbose --output result.txt input.txt
```

## Output

<Describe outputs: files produced, stdout format, side effects.>

### Exit Codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | Success              |
| 1    | General error        |
| 2    | Invalid arguments    |
| 3    | Permission error     |
| 130  | Interrupted (Ctrl+C) |

## See Also

- <related scripts, docs, runbooks>
````
