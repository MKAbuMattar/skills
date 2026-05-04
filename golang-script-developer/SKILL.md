---
name: golang-script-developer
description: Write production-ready Go CLI tools, automation programs, and batch file processors with idiomatic Go patterns — Go modules layout, the standard library flag package by default (or cobra/urfave-cli for complex CLIs), structured logging via log/slog (Go 1.21+), error wrapping with fmt.Errorf %w plus errors.Is/errors.As, context.Context for cancellation and timeouts, signal.NotifyContext for graceful SIGINT/SIGTERM, distinct exit codes per failure mode, embedded assets via //go:embed, race-detector-clean concurrency with errgroup, and cross-platform / cross-compile support (GOOS/GOARCH) for Linux, macOS, Windows. Targets Go 1.22 and above. Use this skill whenever the user asks to create a Go / Golang script, .go program, single-binary CLI tool, automation, batch processor, or data pipeline — including casual phrasings like 'write a go program that ...', 'automate this in golang', 'make me a go CLI', or 'I need a single-binary tool'. Also use when reviewing or hardening an existing Go program.
license: MIT. See LICENSE for full terms.
compatibility: Go 1.22 or newer on Linux, macOS, or Windows. Cross-compiles to any GOOS/GOARCH the toolchain supports.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Go Script Developer

Production-ready Go. Modules layout + flag/cobra + log/slog + error wrapping with %w + context-aware cancellation + signal.NotifyContext + typed exit errors + errgroup concurrency + cross-compile single binaries.

## When to use

- The user asks for any `.go` program, Go CLI, automation, single-binary tool, or batch processor.
- The user wants to harden, refactor, or review an existing Go program.
- A task chain ends in "and put it in a Go program".

Skip this skill for: web servers (different shape — frameworks like `net/http` + `chi`), full applications with persistent storage (database-backed apps need their own architecture), or non-Go scripts (use the matching language skill).

## Required structure

Every program you write starts from this skeleton. Do not omit the typed exit error, `signal.NotifyContext`, or the separation between `main` and `run(ctx, args)`.

```go
// Package main implements <one-line description>.
//
// Usage: my-tool [options] <input>
// Exit:  0 ok, 1 generic, 2 usage, 3 input, 130 interrupt
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

const (
	exitOK = 0; exitGeneric = 1; exitUsage = 2; exitInput = 3
	exitInterrupt = 130
)

type exitError struct{ code int; err error }
func (e *exitError) Error() string { return e.err.Error() }
func (e *exitError) Unwrap() error { return e.err }

type args struct {
	input   string
	verbose bool
}

func parseArgs() (args, error) {
	fs := flag.NewFlagSet("my-tool", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var a args
	fs.BoolVar(&a.verbose, "v", false, "enable debug logging")
	if err := fs.Parse(os.Args[1:]); err != nil { return a, err }
	if fs.NArg() != 1 {
		return a, &exitError{code: exitUsage, err: fmt.Errorf("expected one positional argument")}
	}
	a.input = fs.Arg(0)
	return a, nil
}

func run(ctx context.Context, a args) error {
	slog.Info("processing", "input", a.input)
	// ... real work, respecting ctx
	return nil
}

func main() {
	a, err := parseArgs()
	if err != nil {
		if errors.Is(err, flag.ErrHelp) { os.Exit(exitOK) }
		var ee *exitError
		if errors.As(err, &ee) { fmt.Fprintln(os.Stderr, "error:", err); os.Exit(ee.code) }
		fmt.Fprintln(os.Stderr, "error:", err); os.Exit(exitUsage)
	}

	level := slog.LevelInfo
	if a.verbose { level = slog.LevelDebug }
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, a); err != nil {
		var ee *exitError
		if errors.As(err, &ee) { slog.Error(ee.Error()); os.Exit(ee.code) }
		if errors.Is(err, context.Canceled) { slog.Info("interrupted"); os.Exit(exitInterrupt) }
		slog.Error("unexpected", "err", err); os.Exit(exitGeneric)
	}
}
```

## Workflow

1. **Confirm the Go version.** Default floor: Go 1.22. Bump to 1.23 if you need iterators or `range over func`. Set the floor in `go.mod`'s `go` directive.
2. **Generate / verify `go.mod`** using `assets/templates/go.mod.template`. Module path is `github.com/<owner>/<repo>` by default.
3. **Pick a starting template** from `assets/templates/`:
   - `main.template.go` — single-file program.
   - `cli-tool.template.go` — multi-subcommand CLI, dispatch by hand (no third-party dep).
   - `file-processor.template.go` — batch processing with `errgroup` + bounded concurrency.
4. **Apply patterns** from `references/patterns.md` for module layout, flag parsing, slog, error wrapping with `%w`, sentinel + typed errors, distinct exit codes, context cancellation, `signal.NotifyContext`, errgroup concurrency, `//go:embed`, atomic writes, env-var configs.
5. **Validate the result.** Run `bash scripts/validate-script.sh <your-main.go>` — checks package doc, log/slog, `%w` wrapping, `errors.Is`/`errors.As`, `signal.NotifyContext`, context-as-parameter, exit-code constants, `path/filepath`, no `ioutil`, no `panic`, flag-based argv, `main`+`run` separation, stderr logging, no cgo. Aim for ≥ 90%.
6. **Type-check + vet.** Run `go vet ./...` and `go build ./...` after writing. Add `golangci-lint run` for production code.
7. **Cross-check `references/anti-patterns.md`** — especially `panic` for non-programmer errors, ignoring errors with `_`, `fmt.Errorf("...: %s", err)` instead of `%w`, missing `defer cancel()`, goroutine leaks, `path` vs `path/filepath`.
8. **For cross-platform programs**, load `references/cross-platform.md` and apply the rules (build constraints, `runtime.GOOS`, `os.UserHomeDir`, signal differences).
9. **For shipping**, load `references/build-and-distribution.md` — cross-compile matrix, `goreleaser`, embedded version info, multi-stage Dockerfiles, static binaries.
10. **Generate man-page-style docs** using `references/documentation.md` — GoDoc on every export, plus a `README.md` reference.

## Available resources

- `assets/templates/main.template.go` — single-file program with full main+run split.
- `assets/templates/cli-tool.template.go` — multi-subcommand dispatch (no third-party dep).
- `assets/templates/file-processor.template.go` — batch processing with `errgroup`.
- `assets/templates/go.mod.template` — module file with `go 1.23` and the minimal dep set.
- `assets/examples/csv-analyzer/main.go` — full reference implementation (CSV streaming, gzip, custom error types, Welford running stats, JSON/text output).
- `scripts/validate-script.sh` — score a Go program against the checklist.
- `references/patterns.md` — load when implementing flag parsing, slog, error wrapping, sentinel errors, exit codes, context, signals, errgroup, embed, atomic writes.
- `references/anti-patterns.md` — load when reviewing or rewriting an existing Go program.
- `references/cross-platform.md` — load when targeting Windows or macOS alongside Linux, or cross-compiling.
- `references/build-and-distribution.md` — load when shipping (cross-compile, goreleaser, container images, static binaries).
- `references/documentation.md` — load when generating man-page-style README + GoDoc.

## Top gotchas (always inline — do not skip)

- **Wrap errors with `%w`, never `%s` or `%v`.** `fmt.Errorf("read %q: %w", path, err)`. The `%w` keeps the chain unwrappable. `errors.Is` / `errors.As` only work on chains.
- **`signal.NotifyContext` is the right shutdown primitive.** Don't roll your own `signal.Notify` channel. The context-based version cancels every `ctx`-aware operation in your program for free.
- **`context.Context` as the first parameter, never on a struct field.** Functions take `ctx`; structs hold long-lived state. Holding a context on a struct is a Go-vet warning and a sign of a design problem.
- **`path/filepath` for filesystem paths, `path` for URL/embed paths.** Different packages. `filepath.Join` uses `\\` on Windows.
- **`defer cancel()` after every `context.WithCancel` / `WithTimeout`.** `go vet` flags missing ones. Without it, the parent context leaks resources.
- **Define typed errors with `Unwrap()`.** Subclass with a struct that holds an exit code; in `main`, use `errors.As` to extract the code. Sentinel errors (`var ErrNotFound = errors.New("not found")`) for shape-less cases.
- **`slog`, not `log`.** Stdlib has structured logging since 1.21. The plain `log` is for tiny scripts and stdlib internals.
- **Goroutine leaks are bugs.** Every long-running goroutine respects `ctx.Done()`. No exceptions.
- **`errgroup` for bounded concurrency**, not raw `sync.WaitGroup`. `errgroup.WithContext` cancels siblings on first error; `g.SetLimit(N)` caps concurrency.
- **`//go:embed` files are paths relative to the source file**, with forward slashes. They don't follow OS conventions.
- **`CGO_ENABLED=0` for portable static binaries.** Avoid cgo unless you really need it; it complicates cross-compile, increases binary size, and adds C-toolchain dependencies.
- **`go.mod`'s `go` directive sets the language version.** Features like `range over func` (1.23) need the right version there. Don't assume — check.

## What you DO

1. Start every program from `assets/templates/`.
2. Use `flag.NewFlagSet` (not `flag.Parse` directly on the global). Easier to test and reset.
3. Use `log/slog` for structured logging. Set the level from `--verbose`.
4. Wrap errors with `%w` at every layer boundary.
5. Define typed `*exitError` with `Unwrap` and a `code int` field. Map distinct failures to distinct codes.
6. Take `context.Context` as the first parameter on any function that does I/O or could block.
7. Use `signal.NotifyContext` to wire SIGINT/SIGTERM into the context.
8. Use `errgroup` for parallel work over a slice; cap with `SetLimit(N)`.
9. Use `path/filepath` for filesystem paths; `path` only for URL/embed-style.
10. Use `os.UserHomeDir`, `os.UserCacheDir`, `os.TempDir` instead of hardcoding paths.
11. Run `go vet ./...` and `go build ./...` against every change.
12. Pin the Go version floor in `go.mod`'s `go` directive.

## What you do NOT do

- Use `panic` for non-programmer errors. Return `error` and let `main` decide.
- Use `_` to ignore errors. Handle them or document why with a comment.
- Use `fmt.Errorf("...: %s", err)` to wrap — drops the chain.
- Use `path.Join` for filesystem paths — breaks on Windows.
- Use `init()` for fallible setup. Be explicit and call from `main`.
- Use `interface{}`. Use `any` (since Go 1.18).
- Use `ioutil` (deprecated since 1.16). Use `os.ReadFile` / `os.WriteFile` / `io.ReadAll`.
- Skip `defer cancel()` after `context.WithTimeout`. `go vet` flags this.
- Use `time.Sleep` to wait for async work in tests. Use channels or `eventually` patterns.
- Embed `context.Context` on struct fields. Pass as the first parameter.
- Use `os.Exit` from inside any function except `main`. Skips `defer`.
- Add cgo dependencies casually. They wreck cross-compile and add C toolchain requirements.
