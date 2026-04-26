# Cross-Platform Bash

Load this when targeting more than one OS, or when a tool's flags differ between Linux and macOS. The script must run unchanged on Linux, macOS, and Windows (Git Bash, WSL, MSYS2).

## OS detection

```bash
detect_os() {
    case "$(uname -s)" in
        Linux*)               echo "linux" ;;
        Darwin*)              echo "macos" ;;
        CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
        *)                    echo "unknown" ;;
    esac
}

OS="$(detect_os)"
```

## Compatibility rules

| Concern              | Rule                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| Shebang              | `#!/usr/bin/env bash` — never `#!/bin/bash` (macOS ships Bash 3.2 there; Alpine has no Bash) |
| Line endings         | Always LF (`\n`). Editors set to "auto" can corrupt scripts on Windows. Use `.editorconfig`. |
| Path separators      | Use `/`. Bash on Windows (Git Bash, WSL, MSYS2) handles it.                            |
| `sed -i` in-place    | `sed -i'' -e '...' file` (empty string after `-i` is required by macOS BSD `sed`)      |
| `readlink -f`        | Not on macOS. Use `"$(cd "$(dirname "$0")" && pwd)"`                                   |
| `date` formatting    | macOS uses BSD `date`; avoid `date -d "1 day ago"`. Use `date -v-1d` on macOS or compute in another tool. |
| `grep -P`            | PCRE not on macOS. Use `grep -E` (extended regex)                                      |
| `stat` format        | Different on macOS vs Linux. Use `wc -c < "$file"` for size                            |
| Temp dir             | `${TMPDIR:-/tmp}` — never hardcode `/tmp`                                              |
| `mktemp`             | `mktemp -t prefix.XXXXXX` is portable; avoid `--suffix` (GNU only)                     |
| `realpath`           | Not on macOS by default. Use the `cd && pwd` idiom                                     |
| `xargs -r`           | `--no-run-if-empty` is GNU-only. macOS `xargs` skips empty stdin already.              |
| `find -printf`       | GNU only. Use `find ... -exec printf` or `find ... | while read`.                      |
| Color output         | Check `[ -t 1 ]` before emitting ANSI codes                                            |
| Windows note         | Document that the script needs Git Bash, WSL, or MSYS2 — plain `cmd.exe` won't work    |

## Platform-specific install commands

```bash
case "$OS" in
    linux)
        # Detect distro family
        if   [ -f /etc/debian_version ]; then INSTALL="sudo apt-get install -y"
        elif [ -f /etc/redhat-release ]; then INSTALL="sudo dnf install -y"
        elif [ -f /etc/arch-release   ]; then INSTALL="sudo pacman -S --noconfirm"
        else INSTALL="" ; fi
        ;;
    macos)
        INSTALL="brew install"
        ;;
    windows)
        INSTALL="choco install -y"   # or: scoop install
        ;;
esac
```

## Verifying portable behavior

When in doubt, run the suspect command in a Docker image to verify:

```bash
docker run --rm -v "$PWD:/work" -w /work alpine:3.20 sh -c 'apk add --no-cache bash && bash script.sh'
docker run --rm -v "$PWD:/work" -w /work bash:5 bash script.sh
```

For macOS-specific behavior, the canonical fix is the BSD-vs-GNU table above — there's rarely a need to test on actual macOS for the common pitfalls.
