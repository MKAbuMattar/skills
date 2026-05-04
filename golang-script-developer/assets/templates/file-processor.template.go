// Package main is a batch file processor.
//
// Walks a directory, processes each matching file with bounded concurrency,
// writes results, reports progress.
//
// Usage: file-processor [options] <input-dir>
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"
)

// ---------- exit codes ----------

const (
	exitOK        = 0
	exitGeneric   = 1
	exitUsage     = 2
	exitInterrupt = 130
)

type exitError struct {
	code int
	err  error
}

func (e *exitError) Error() string { return e.err.Error() }
func (e *exitError) Unwrap() error { return e.err }

func usageErr(format string, a ...any) error {
	return &exitError{code: exitUsage, err: fmt.Errorf(format, a...)}
}

// ---------- args ----------

type args struct {
	inputDir    string
	outputDir   string
	pattern     string
	concurrency int
	verbose     bool
}

func parseArgs() (args, error) {
	fs := flag.NewFlagSet("file-processor", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	var a args
	fs.StringVar(&a.outputDir, "o", "./out", "output directory")
	fs.StringVar(&a.pattern, "p", ".json", "file extension to match")
	fs.IntVar(&a.concurrency, "c", 8, "parallel workers")
	fs.BoolVar(&a.verbose, "v", false, "enable debug logging")

	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: file-processor [options] <input-dir>\n\n")
		fs.PrintDefaults()
	}

	if err := fs.Parse(os.Args[1:]); err != nil {
		return a, err
	}
	if fs.NArg() != 1 {
		return a, usageErr("expected exactly one positional argument: <input-dir>")
	}
	if a.concurrency < 1 {
		return a, usageErr("--concurrency must be positive, got %d", a.concurrency)
	}
	a.inputDir = fs.Arg(0)
	return a, nil
}

// ---------- per-file work ----------

func processOne(ctx context.Context, srcPath, srcRoot, outRoot string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	rel, err := filepath.Rel(srcRoot, srcPath)
	if err != nil {
		return fmt.Errorf("rel %q: %w", srcPath, err)
	}
	outPath := filepath.Join(outRoot, rel)

	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	data, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("read %q: %w", srcPath, err)
	}

	// Replace with the actual transformation:
	transformed := data

	// Atomic write
	tmp := outPath + ".tmp"
	if err := os.WriteFile(tmp, transformed, 0o644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmp, outPath); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename: %w", err)
	}

	slog.Debug("processed", "rel", rel)
	return nil
}

// ---------- main work ----------

func run(ctx context.Context, a args) error {
	info, err := os.Stat(a.inputDir)
	if err != nil {
		return fmt.Errorf("stat input: %w", err)
	}
	if !info.IsDir() {
		return usageErr("input is not a directory: %s", a.inputDir)
	}

	// Collect matching files first so we know the total
	var files []string
	err = filepath.WalkDir(a.inputDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil { return err }
		if d.IsDir() { return nil }
		if strings.HasSuffix(p, a.pattern) {
			files = append(files, p)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("walk: %w", err)
	}
	slog.Info("found files", "count", len(files), "pattern", a.pattern)
	if len(files) == 0 {
		return nil
	}

	// Process with bounded concurrency
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(a.concurrency)

	var done atomic.Int64
	startedAt := time.Now()

	for _, f := range files {
		f := f // capture for closure (unnecessary in Go 1.22+, kept for clarity)
		g.Go(func() error {
			if err := processOne(gctx, f, a.inputDir, a.outputDir); err != nil {
				return fmt.Errorf("%s: %w", f, err)
			}
			n := done.Add(1)
			if n%50 == 0 || n == int64(len(files)) {
				pct := float64(n) / float64(len(files)) * 100
				fmt.Fprintf(os.Stderr, "\r%d/%d (%.1f%%, %.1fs)",
					n, len(files), pct, time.Since(startedAt).Seconds())
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		fmt.Fprintln(os.Stderr) // newline after the progress carriage return
		return err
	}
	fmt.Fprintln(os.Stderr)
	slog.Info("done", "ok", done.Load())
	return nil
}

// ---------- main ----------

func main() {
	a, err := parseArgs()
	if err != nil {
		if errors.Is(err, flag.ErrHelp) { os.Exit(exitOK) }
		fmt.Fprintln(os.Stderr, "error:", err)
		var ee *exitError
		if errors.As(err, &ee) { os.Exit(ee.code) }
		os.Exit(exitUsage)
	}

	level := slog.LevelInfo
	if a.verbose { level = slog.LevelDebug }
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr,
		&slog.HandlerOptions{Level: level})))

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
}
