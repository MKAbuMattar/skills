// Package main implements <one-line description>.
//
// Usage: my-tool [options] <input>
//
// Exit codes:
//
//	0 — success
//	1 — generic error
//	2 — usage / bad arguments
//	3 — input not found / unreadable
//	130 — killed by SIGINT
//	143 — killed by SIGTERM
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

// ---------- exit codes ----------

const (
	exitOK        = 0
	exitGeneric   = 1
	exitUsage     = 2
	exitInput     = 3
	exitInterrupt = 130
	exitTerminate = 143
)

// ---------- typed error with exit code ----------

type exitError struct {
	code int
	err  error
}

func (e *exitError) Error() string { return e.err.Error() }
func (e *exitError) Unwrap() error { return e.err }

func usageErr(format string, a ...any) error {
	return &exitError{code: exitUsage, err: fmt.Errorf(format, a...)}
}

func inputErr(format string, a ...any) error {
	return &exitError{code: exitInput, err: fmt.Errorf(format, a...)}
}

// ---------- args ----------

type args struct {
	input   string
	output  string
	verbose bool
}

func parseArgs() (args, error) {
	fs := flag.NewFlagSet("my-tool", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	var a args
	fs.StringVar(&a.output, "o", "", "output file path (default: stdout)")
	fs.StringVar(&a.output, "output", "", "output file path (default: stdout)")
	fs.BoolVar(&a.verbose, "v", false, "enable debug logging")
	fs.BoolVar(&a.verbose, "verbose", false, "enable debug logging")

	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: my-tool [options] <input>\n\n")
		fmt.Fprintf(os.Stderr, "  <one-line description>\n\n")
		fmt.Fprintf(os.Stderr, "options:\n")
		fs.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nexit codes: 0=ok, 1=error, 2=usage, 3=input, 130=interrupt\n")
	}

	if err := fs.Parse(os.Args[1:]); err != nil {
		return a, err
	}
	if fs.NArg() != 1 {
		return a, usageErr("expected exactly one positional argument: <input>")
	}
	a.input = fs.Arg(0)
	return a, nil
}

// ---------- logger ----------

func newLogger(verbose bool) *slog.Logger {
	level := slog.LevelInfo
	if verbose {
		level = slog.LevelDebug
	}
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
	}))
}

// ---------- main work ----------

func run(ctx context.Context, a args) error {
	slog.Info("processing", "input", a.input)

	f, err := os.Open(a.input)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return inputErr("input not found: %s", a.input)
		}
		return fmt.Errorf("open %q: %w", a.input, err)
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("read %q: %w", a.input, err)
	}
	slog.Debug("read bytes", "n", len(data))

	// Replace with the actual transformation:
	result := data

	// Output
	var out io.Writer = os.Stdout
	if a.output != "" {
		of, err := os.Create(a.output)
		if err != nil {
			return fmt.Errorf("create %q: %w", a.output, err)
		}
		defer of.Close()
		out = of
	}
	if _, err := out.Write(result); err != nil {
		return fmt.Errorf("write: %w", err)
	}

	// Respect cancellation between phases:
	if err := ctx.Err(); err != nil {
		return err
	}

	return nil
}

// ---------- main ----------

func main() {
	a, err := parseArgs()
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			os.Exit(exitOK)
		}
		fmt.Fprintln(os.Stderr, "error:", err)
		var ee *exitError
		if errors.As(err, &ee) {
			os.Exit(ee.code)
		}
		os.Exit(exitUsage)
	}

	slog.SetDefault(newLogger(a.verbose))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, a); err != nil {
		var ee *exitError
		if errors.As(err, &ee) {
			slog.Error(ee.Error())
			os.Exit(ee.code)
		}
		if errors.Is(err, context.Canceled) {
			slog.Info("interrupted")
			os.Exit(exitInterrupt)
		}
		slog.Error("unexpected", "err", err)
		os.Exit(exitGeneric)
	}
	os.Exit(exitOK)
}
