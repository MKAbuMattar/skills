# Patterns

Load this when implementing CLI parsing, structured logging, error wrapping, context cancellation, or concurrency in Go.

## Module layout

For a single-binary CLI:

```
my-tool/
├── go.mod              # module github.com/owner/my-tool
├── go.sum
├── main.go             # entrypoint; tiny — just calls into /internal
├── README.md
├── Makefile            # optional but useful
├── cmd/                # for multi-binary repos; can omit for single-binary
│   └── my-tool/
│       └── main.go
└── internal/           # private packages, by convention not importable elsewhere
    ├── cli/
    │   └── cli.go      # flag parsing, dispatch
    ├── runner/
    │   └── runner.go   # the real work
    └── logging/
        └── logging.go  # slog setup
```

For a tiny one-file program: just `main.go` + `go.mod`. Skip `internal/`.

## CLI parsing with `flag` (stdlib)

The standard library's `flag` package is the right choice for simple CLIs (≤ 5 flags, no subcommands). Reach for cobra / urfave-cli when subcommands or rich help text matter.

```go
package main

import (
	"flag"
	"fmt"
	"os"
)

type Args struct {
	Input   string
	Output  string
	Count   int
	Verbose bool
}

func parseArgs() (Args, error) {
	fs := flag.NewFlagSet("my-tool", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	var a Args
	fs.StringVar(&a.Output, "o", "", "output file (default: stdout)")
	fs.StringVar(&a.Output, "output", "", "output file (default: stdout)")
	fs.IntVar(&a.Count, "c", 10, "number of items to process")
	fs.IntVar(&a.Count, "count", 10, "number of items to process")
	fs.BoolVar(&a.Verbose, "v", false, "enable debug logging")
	fs.BoolVar(&a.Verbose, "verbose", false, "enable debug logging")

	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: my-tool [options] <input>\n\n")
		fs.PrintDefaults()
	}

	if err := fs.Parse(os.Args[1:]); err != nil {
		return a, err // ErrHelp returns here too
	}
	if fs.NArg() != 1 {
		return a, fmt.Errorf("expected exactly one positional argument: <input>")
	}
	if a.Count <= 0 {
		return a, fmt.Errorf("--count must be positive, got %d", a.Count)
	}

	a.Input = fs.Arg(0)
	return a, nil
}
```

## Subcommands with `flag` only (no third-party dep)

For 2-4 subcommands, dispatch by hand:

```go
func main() {
	if len(os.Args) < 2 {
		printGlobalHelp()
		os.Exit(2)
	}

	switch os.Args[1] {
	case "build":
		os.Exit(cmdBuild(os.Args[2:]))
	case "deploy":
		os.Exit(cmdDeploy(os.Args[2:]))
	case "status":
		os.Exit(cmdStatus(os.Args[2:]))
	case "-h", "--help", "help":
		printGlobalHelp()
		os.Exit(0)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		os.Exit(2)
	}
}

func cmdBuild(args []string) int {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	env := fs.String("env", "dev", "target environment")
	if err := fs.Parse(args); err != nil { return 2 }
	// ... do build
	_ = env
	return 0
}
```

For 5+ subcommands or nested commands, use `cobra` (`github.com/spf13/cobra`) or `urfave/cli` (`github.com/urfave/cli/v3`). Both are stable.

## Structured logging with `log/slog` (Go 1.21+)

```go
import (
	"log/slog"
	"os"
)

func newLogger(verbose bool) *slog.Logger {
	level := slog.LevelInfo
	if verbose {
		level = slog.LevelDebug
	}
	handler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
		// Use ReplaceAttr to format time differently or hide noise.
	})
	return slog.New(handler)
}

// Usage:
log := newLogger(args.Verbose)
log.Info("processing", "input", args.Input)
log.Debug("read bytes", "n", len(content))
log.Error("write failed", "path", outPath, "err", err)
```

For JSON output (machine-readable logs), swap `NewTextHandler` for `NewJSONHandler`. For production services, consider `lmittmann/tint` (colorized text handler) or `slog-logfmt` (logfmt format).

`log/slog` ships with the stdlib in Go 1.21+. For older Go, use `golang.org/x/exp/slog` with the same API.

## Error wrapping with `fmt.Errorf %w`

Always wrap when crossing a layer boundary. Lose the chain only at the top of `main`:

```go
import (
	"errors"
	"fmt"
	"os"
)

func readConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %q: %w", path, err)
	}
	cfg, err := parseConfig(data)
	if err != nil {
		return nil, fmt.Errorf("parse config %q: %w", path, err)
	}
	return cfg, nil
}

// At the call site:
cfg, err := readConfig("./config.yaml")
if err != nil {
	if errors.Is(err, os.ErrNotExist) {
		// recover or warn
	}
	return fmt.Errorf("startup: %w", err)
}
```

`%w` makes the wrapped error unwrappable. `%v` does not. Always use `%w` when chaining, `%v` only for terminal formatting.

## Sentinel errors and typed errors

Define sentinel errors at package scope:

```go
var (
	ErrNotFound = errors.New("not found")
	ErrInvalid  = errors.New("invalid input")
)
```

Compare with `errors.Is`:

```go
if errors.Is(err, ErrNotFound) {
	// handle
}
```

For richer errors, define a struct that implements `error` and (optionally) `Unwrap`:

```go
type InputError struct {
	Path string
	Err  error
}

func (e *InputError) Error() string {
	return fmt.Sprintf("input %s: %v", e.Path, e.Err)
}

func (e *InputError) Unwrap() error { return e.Err }
```

Extract with `errors.As`:

```go
var ie *InputError
if errors.As(err, &ie) {
	log.Error("input error", "path", ie.Path, "err", ie.Err)
}
```

## Distinct exit codes via custom `Error` types

```go
type ExitError struct {
	Code int
	Err  error
}

func (e *ExitError) Error() string { return e.Err.Error() }
func (e *ExitError) Unwrap() error { return e.Err }

const (
	ExitOK        = 0
	ExitGeneric   = 1
	ExitUsage     = 2
	ExitInput     = 3
	ExitNetwork   = 4
	ExitInterrupt = 130
)

func usageErr(format string, a ...any) error {
	return &ExitError{Code: ExitUsage, Err: fmt.Errorf(format, a...)}
}
```

In `main`:

```go
if err := run(args); err != nil {
	var exitErr *ExitError
	if errors.As(err, &exitErr) {
		fmt.Fprintln(os.Stderr, exitErr.Error())
		os.Exit(exitErr.Code)
	}
	fmt.Fprintln(os.Stderr, err)
	os.Exit(ExitGeneric)
}
```

## Context for cancellation

Pass `context.Context` as the first argument to any function that:

- Does I/O (network, files, child processes).
- Could take more than ~100ms.
- Should respect SIGINT / SIGTERM.

```go
func fetch(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil { return nil, err }
	resp, err := http.DefaultClient.Do(req)
	if err != nil { return nil, fmt.Errorf("http: %w", err) }
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
```

For timeouts:

```go
ctx, cancel := context.WithTimeout(parent, 30*time.Second)
defer cancel()
data, err := fetch(ctx, url)
```

## Signal handling with `signal.NotifyContext` (Go 1.16+)

The clean way to wire SIGINT / SIGTERM into a `context.Context`:

```go
import (
	"context"
	"os/signal"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx); err != nil {
		// ...
		os.Exit(1)
	}
}
```

When the user hits Ctrl-C or `kill -TERM`, `ctx` becomes done. Any `ctx.Err()`-aware code (HTTP requests, channel selects, etc.) will unwind cleanly.

## Concurrency with `errgroup`

For bounded concurrency over a slice of work:

```go
import "golang.org/x/sync/errgroup"

func processAll(ctx context.Context, items []Item) error {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(8) // max concurrent goroutines

	for _, item := range items {
		item := item // capture range var (pre-Go 1.22 — Go 1.22+ does this automatically)
		g.Go(func() error {
			return processOne(gctx, item)
		})
	}
	return g.Wait()
}
```

`errgroup.WithContext` cancels the group context when any goroutine returns an error. `SetLimit(n)` caps concurrency. The whole pattern is the idiomatic answer to "how do I do parallel work with cancellation?".

## File handling (no `path/filepath` confusion)

Always use `path/filepath` for filesystem paths (handles separators per OS), `path` only for forward-slash paths (URLs, embed paths).

```go
import "path/filepath"

p := filepath.Join(dir, "subdir", "file.txt")
// → "/dir/subdir/file.txt" on POSIX, "\\dir\\subdir\\file.txt" on Windows
```

For atomic writes:

```go
func writeAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".tmp.*")
	if err != nil { return err }
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op if rename succeeds

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil { tmp.Close(); return err }
	if err := tmp.Close(); err != nil { return err }
	if err := os.Chmod(tmpName, perm); err != nil { return err }
	return os.Rename(tmpName, path)
}
```

## Embedded assets with `//go:embed` (Go 1.16+)

For shipping templates, configs, or static files inside the binary:

```go
import _ "embed"

//go:embed assets/template.txt
var templateData string

//go:embed assets/*.json
var configsFS embed.FS
```

The `//go:embed` directive must come immediately before the variable declaration. Files referenced are bundled into the binary at compile time.

## Reading config

For YAML: `gopkg.in/yaml.v3`. For TOML: `github.com/BurntSushi/toml`. For JSON: stdlib `encoding/json`. For env vars with strict typing: `github.com/caarlos0/env/v11`.

```go
type Config struct {
	APIURL  string `env:"API_URL,required"`
	Port    int    `env:"PORT" envDefault:"8080"`
	Timeout time.Duration `env:"TIMEOUT" envDefault:"30s"`
}

cfg, err := env.ParseAs[Config]()
```

For one-off scripts, just read `os.Getenv("API_KEY")` and validate inline.

## Process lifecycle template

```go
func main() {
	args, err := parseArgs()
	if err != nil {
		if errors.Is(err, flag.ErrHelp) { os.Exit(0) }
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(2)
	}

	logger := newLogger(args.Verbose)
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, args); err != nil {
		var exitErr *ExitError
		if errors.As(err, &exitErr) {
			slog.Error(exitErr.Error())
			os.Exit(exitErr.Code)
		}
		if errors.Is(err, context.Canceled) {
			slog.Info("interrupted")
			os.Exit(ExitInterrupt)
		}
		slog.Error("unexpected", "err", err)
		os.Exit(ExitGeneric)
	}
}

func run(ctx context.Context, args Args) error {
	// ... real work ...
	return nil
}
```
