# Cross-Platform Makefiles

Patterns for Makefiles that must run on Linux, macOS, and Windows (WSL, MSYS2, Git Bash).

---

## 1. Platform detection via `uname`

```makefile
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Linux)
    PLATFORM := linux
    BINARY   := myapp-linux-$(UNAME_M)
    EXT      :=
    SEP      := :
endif
ifeq ($(UNAME_S),Darwin)
    PLATFORM := macos
    BINARY   := myapp-macos-$(UNAME_M)
    EXT      :=
    SEP      := :
endif
ifeq ($(OS),Windows_NT)
    PLATFORM := windows
    BINARY   := myapp-windows-$(UNAME_M)
    EXT      := .exe
    SEP      := ;
endif
```

| Variable | Linux | macOS | Windows |
| --- | --- | --- | --- |
| `$(UNAME_S)` | `Linux` | `Darwin` | (empty / "MINGW64_NT-...") |
| `$(OS)` | unset | unset | `Windows_NT` |
| `$(UNAME_M)` | `x86_64` / `aarch64` | `x86_64` / `arm64` | `x86_64` |
| `EXT` | empty | empty | `.exe` |
| `SEP` (PATH-like) | `:` | `:` | `;` |

`$(OS)` is the most reliable Windows detector since `uname` may not exist on cmd.exe but does on Git Bash / WSL.

---

## 2. Always set `SHELL := /bin/bash`

On macOS, `/bin/sh` is bash-in-POSIX-mode (no `pipefail`, no arrays). On Alpine and minimal Linux, `/bin/sh` is dash. Always pin to `/bin/bash`:

```makefile
SHELL       := /bin/bash
.SHELLFLAGS := -euo pipefail -c
```

If bash isn't on `/bin/bash` (rare): override with `SHELL := bash` (uses `$PATH`) or wire to `/usr/local/bin/bash` for macOS+Homebrew bash 5.

---

## 3. BSD vs GNU command flags

### `sed -i` — in-place edit

```makefile
# ❌ Linux-only:
sed -i 's/foo/bar/' file

# ❌ macOS-only:
sed -i '' 's/foo/bar/' file

# ✅ Both:
sed -i'' -e 's/foo/bar/' file
# (no space between -i and '', and use -e to make positional intent explicit)
```

Or detect:

```makefile
ifeq ($(UNAME_S),Darwin)
    SED_INPLACE := sed -i ''
else
    SED_INPLACE := sed -i
endif
```

### `readlink -f` — absolute path (GNU only)

```makefile
# ❌ macOS doesn't ship `readlink -f`
ABSPATH := $(shell readlink -f $(file))

# ✅ Portable:
ABSPATH := $(shell cd $(dir $(file)) && pwd)/$(notdir $(file))
```

Or install GNU coreutils on macOS via Homebrew (`brew install coreutils` → `greadlink -f`).

### `date -d` (GNU) vs `date -v` (BSD)

```makefile
# ❌ Linux-only:
TOMORROW := $(shell date -d 'tomorrow' +%Y-%m-%d)

# ❌ macOS-only:
TOMORROW := $(shell date -v+1d +%Y-%m-%d)

# ✅ Cross-platform: use Python (one-liner):
TOMORROW := $(shell python3 -c "import datetime; print(datetime.date.today() + datetime.timedelta(days=1))")
```

### `grep -P` (Perl regex)

GNU grep supports `-P`; BSD grep doesn't. Use `grep -E` (extended) wherever possible.

---

## 4. PyInstaller `--add-data` separator

PyInstaller uses different separators per platform:

```makefile
# Linux/macOS:  src:dst
# Windows:      src;dst

ADD_DATA := rawi/data$(SEP)rawi/data
# expands to:  rawi/data:rawi/data       (Linux/macOS)
#              rawi/data;rawi/data       (Windows)

build:
	pyinstaller --add-data "$(ADD_DATA)" entry.py
```

Same for Java classpaths and PATH-like vars.

---

## 5. Binary suffix

```makefile
APP_NAME := myapp
EXT      := $(if $(filter Windows_NT,$(OS)),.exe,)
BINARY   := $(APP_NAME)$(EXT)

build:
	go build -o dist/$(BINARY)

install:
	install -m 755 dist/$(BINARY) /usr/local/bin/$(APP_NAME)$(EXT)
```

---

## 6. `find` differences

```makefile
# ❌ GNU-only `-printf`:
find . -name '*.go' -printf '%f\n'

# ✅ Portable:
find . -name '*.go' -exec basename {} \;

# ❌ GNU-only `-regextype`:
find . -regextype posix-extended -regex '.*\.(ts|tsx)$$'

# ✅ Portable:
find . \( -name '*.ts' -o -name '*.tsx' \)
```

---

## 7. `xargs` differences

GNU `xargs -r` (skip if no input) is missing on BSD. Workaround:

```makefile
# ❌ GNU-only:
ls *.tmp 2>/dev/null | xargs -r rm

# ✅ Portable:
files=$$(ls *.tmp 2>/dev/null); [ -n "$$files" ] && rm $$files || true
```

---

## 8. `realpath` / `pwd -P` for symlinks

```makefile
# ❌ GNU `realpath` not always present:
ABSPATH := $(shell realpath $(SCRIPT))

# ✅ Portable:
ABSPATH := $(shell cd "$(dir $(SCRIPT))" && pwd -P)/$(notdir $(SCRIPT))
```

`pwd -P` (resolve symlinks) is in POSIX, so it works on macOS, Linux, and Git Bash.

---

## 9. Process count for `-j` parallelism

```makefile
# Use as: make -j$(NPROC) build
ifeq ($(UNAME_S),Linux)
    NPROC := $(shell nproc)
endif
ifeq ($(UNAME_S),Darwin)
    NPROC := $(shell sysctl -n hw.logicalcpu)
endif
NPROC ?= 2  # fallback
```

---

## 10. `tar` differences

GNU `tar`'s `--strip-components=N`, `--owner=root`, `--group=root` work everywhere modern. The big trap is `tar -z` vs `tar -j` vs `tar -J` for compression — all three work on both BSD and GNU tar. But on Windows MSYS2, the `tar` from `gnuwin32` may interpret paths differently — prefer `tar` from `git for windows` which understands cygwin-style paths.

---

## 11. Detecting tools at parse time

```makefile
HAS_YQ := $(shell command -v yq 2>/dev/null)
HAS_JQ := $(shell command -v jq 2>/dev/null)

ifeq ($(HAS_YQ),)
$(warning yq not found — install via 'brew install yq' or 'snap install yq')
endif
```

`$(warning ...)` prints but doesn't halt; `$(error ...)` halts. Use the latter for *required* tools, the former for optional ones.

---

## 12. Path quoting

Spaces in paths (especially common on Windows / macOS user dirs) require quoting:

```makefile
# ❌ Breaks if SECRETS_DIR contains a space:
deploy:
	cp $(SECRETS_DIR)/key.pem .

# ✅ Always quote:
deploy:
	cp "$(SECRETS_DIR)/key.pem" .
```

This is the same as the bash quoting rule — Make doesn't quote for you.

---

## 13. Newline handling — CRLF vs LF

If the Makefile is checked in with CRLF line endings (common on Windows), GNU make on Linux/macOS chokes. Configure `.gitattributes`:

```
Makefile text eol=lf
*.mk      text eol=lf
```

Detection (the lazy way): `cat -A Makefile | grep '\^M'` shows `^M$` if CRLF is present.
