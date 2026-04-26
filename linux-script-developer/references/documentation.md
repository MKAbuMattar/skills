# Reference Documentation Template

Every script needs accompanying AWS-style reference documentation — either inline as a markdown block at the top of the script, or as a sibling `<script-name>.md`.

## Rules

1. **Always generate** when creating a new script.
2. **Keep in sync** when the script changes.
3. **No placeholders** — fill every section. No `TODO`, `TBD`, or `<...>` left behind.
4. **Platform table is mandatory** — list Windows, macOS, and Linux explicitly.
5. **Examples must show cross-platform invocation** — `./script.sh` (Linux/macOS) and `bash script.sh` (Windows).

## Template

````markdown
# <script-name>

## Description

<One or two paragraphs explaining what the script does, when to use it, and what
problem it solves.>

## Synopsis

```
<script-name> [OPTIONS] <required-args>
```

## Options

| Option            | Type   | Required | Default | Description                  |
| ----------------- | ------ | -------- | ------- | ---------------------------- |
| `-h`, `--help`    | flag   | No       | —       | Show help message and exit   |
| `-v`, `--verbose` | flag   | No       | —       | Enable verbose output        |
| `-o`, `--output`  | string | No       | stdout  | Output file path             |
| `<input>`         | string | Yes      | —       | Input file or directory path |

## Supported Platforms

| Platform              | Supported | Notes                                               |
| --------------------- | --------- | --------------------------------------------------- |
| Linux (Ubuntu/Debian) | Yes       | Bash 4.0+                                           |
| Linux (RHEL/Fedora)   | Yes       | Bash 4.0+                                           |
| macOS                 | Yes       | Bash 3.2+ (system) or Bash 5 via Homebrew           |
| Windows (WSL)         | Yes       | WSL 1 or WSL 2                                      |
| Windows (Git Bash)    | Yes       | Git for Windows 2.x+                                |
| Windows (MSYS2)       | Yes       | MSYS2 with bash                                     |

## Prerequisites

- Bash 4.0 or later
- `jq` (optional, for JSON processing)
- <other tools and minimum versions>

## Examples

### Basic usage

```bash
# Linux / macOS
./script.sh input.txt

# Windows (Git Bash / WSL)
bash script.sh input.txt
```

### With options

```bash
./script.sh --verbose --output result.txt input.txt
```

## Output

<Describe outputs: files created, stdout format, side effects.>

### Exit Codes

| Code | Meaning           |
| ---- | ----------------- |
| 0    | Success           |
| 1    | General error     |
| 2    | Invalid arguments |

## See Also

- <related scripts, docs, runbooks>
````
