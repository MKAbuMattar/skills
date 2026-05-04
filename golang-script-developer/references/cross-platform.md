# Cross-platform

Load this when targeting macOS / Windows / Linux from one Go program. Most things "just work" with the standard library. The cross-compile story is a Go strength — single binaries for any OS/arch from any host.

## Cross-compiling

```bash
# Linux (default on Linux hosts)
GOOS=linux   GOARCH=amd64 go build -o my-tool-linux-amd64 .
GOOS=linux   GOARCH=arm64 go build -o my-tool-linux-arm64 .

# macOS
GOOS=darwin  GOARCH=amd64 go build -o my-tool-darwin-amd64 .
GOOS=darwin  GOARCH=arm64 go build -o my-tool-darwin-arm64 .

# Windows
GOOS=windows GOARCH=amd64 go build -o my-tool-windows-amd64.exe .
GOOS=windows GOARCH=arm64 go build -o my-tool-windows-arm64.exe .
```

For static Linux binaries (no glibc dependency, runnable in scratch containers):

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o my-tool .
```

The `-s -w` flags strip debug info; the binary is ~30% smaller.

## Path separators

```go
import "path/filepath"

p := filepath.Join(dir, "subdir", "file.txt")
// → "/dir/subdir/file.txt" on POSIX, "\\dir\\subdir\\file.txt" on Windows
```

Never concatenate with `/` or `\\`. `filepath.Join` handles it.

## Detecting the platform

```go
import "runtime"

switch runtime.GOOS {
case "windows":
	// Windows
case "darwin":
	// macOS
case "linux":
	// Linux
default:
	// freebsd, openbsd, netbsd, solaris, ...
}
```

`runtime.GOOS` and `runtime.GOARCH` are constants set at compile time. Free.

## Build constraints

For platform-specific code, use file naming or build tags:

### File naming

`server_linux.go` — only built when `GOOS=linux`.
`server_windows.go` — only built when `GOOS=windows`.
`server_unix.go` — convention: only built when `GOOS != windows` (requires explicit `//go:build` directive — see below).

### Build tags

```go
//go:build linux || darwin

package mypkg

// ... POSIX-only code ...
```

```go
//go:build windows

package mypkg

// ... Windows-only code ...
```

Build tags must be the first non-blank line, with a blank line after the tag and before `package`.

## Signals

POSIX has SIGINT, SIGTERM, SIGHUP, SIGQUIT, SIGUSR1, SIGUSR2. Windows has only SIGINT (Ctrl-C) and a synthetic SIGTERM (sent by Windows Service Manager during shutdown).

Idiomatic cross-platform shutdown:

```go
import (
	"context"
	"os/signal"
	"syscall"
)

ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
```

`os.Interrupt` is `SIGINT` on POSIX and Ctrl-C on Windows. `syscall.SIGTERM` is real on POSIX, synthetic on Windows. Both work in this expression.

## Executable suffix

Windows expects `.exe`. POSIX has none. When you write a binary path:

```go
import "runtime"

func exeName(base string) string {
	if runtime.GOOS == "windows" {
		return base + ".exe"
	}
	return base
}
```

When invoking another binary via `os/exec`, the stdlib does the right thing automatically — `exec.Command("git", ...)` finds `git.exe` on Windows.

## Home / temp directories

```go
import "os"

home, err := os.UserHomeDir()
// /Users/x on macOS, /home/x on Linux, C:\Users\x on Windows

cache, err := os.UserCacheDir()
// ~/Library/Caches on macOS, ~/.cache on Linux (XDG), %LocalAppData% on Windows

config, err := os.UserConfigDir()
// ~/Library/Application Support on macOS, ~/.config on Linux (XDG), %AppData% on Windows

tmp := os.TempDir()
// /tmp on POSIX, %TEMP% on Windows
```

These follow the platform conventions — use them instead of hardcoding paths.

## Line endings

By default, Go writes whatever you tell it to. To write platform-native line endings:

```go
import (
	"runtime"
	"strings"
)

func nativeNewline() string {
	if runtime.GOOS == "windows" {
		return "\r\n"
	}
	return "\n"
}
```

But mostly: just write `\n`. Git handles conversion. Editors handle reading.

## Console colors

Modern terminals on all OSes support ANSI. Use `github.com/fatih/color` or `github.com/charmbracelet/lipgloss` — both auto-detect color support and work on Windows 10+, macOS, and Linux terminals.

```go
import "github.com/fatih/color"

red := color.New(color.FgRed).SprintFunc()
fmt.Fprintln(os.Stderr, red("error:"), msg)
```

For zero-dep, manual ANSI works on Windows 10+ (where `cmd.exe` and PowerShell both support virtual terminal sequences) but not legacy Win 7 cmd. Use the library if you care about old Windows.

## File modes / permissions

POSIX uses rwx bits. Windows mostly ignores them except read-only. Be aware that:

- `os.Chmod(0700)` on Windows only flips the read-only bit.
- Files created on Windows have `0666` mode in Go's view, but Windows ACLs do their own thing.

For lockfiles or token files that need to be private:

```go
if runtime.GOOS != "windows" {
	if err := os.Chmod(path, 0600); err != nil { return err }
}
// On Windows, NTFS ACLs from inheritance handle this — no portable Go API.
```

## CGO and cross-compilation

Plain Go (`CGO_ENABLED=0`) cross-compiles trivially. Anything that uses `cgo` (database drivers like `mattn/go-sqlite3`, image libs, etc.) makes cross-compile painful — you need a C cross-toolchain.

For maximum portability: prefer pure-Go alternatives.

- SQLite: `modernc.org/sqlite` (pure Go) instead of `mattn/go-sqlite3` (cgo).
- Image: `image/jpeg`, `image/png` (stdlib) instead of cgo-bound libs.

## `go:embed` is platform-independent

```go
//go:embed assets/template.txt
var templateData string
```

Embedded at compile time. Works on every platform without changes.

## Test on at least two

Cross-platform bugs hide until they hit a non-developer machine. CI should run tests on at least Linux + macOS + Windows for any tool that claims cross-platform support. GitHub Actions, GitLab, and other major CI providers offer Windows + macOS runners.

```yaml
# .github/workflows/test.yml (sketch)
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
runs-on: ${{ matrix.os }}
```
