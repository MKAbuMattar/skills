// Package main implements a multi-subcommand CLI tool.
//
// Usage: my-tool <subcommand> [options]
//
// Subcommands:
//
//	build    Build the project
//	deploy   Deploy to an environment
//	status   Show current status
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

// ---------- subcommands ----------

type subcommand func(ctx context.Context, args []string) error

func cmdBuild(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	env := fs.String("env", "dev", "target environment")
	if err := fs.Parse(args); err != nil { return err }

	slog.Info("building", "env", *env)
	// ... real work, respecting ctx
	return nil
}

func cmdDeploy(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("deploy", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	env := fs.String("env", "", "target environment (required)")
	dryRun := fs.Bool("dry-run", false, "do not apply changes")
	if err := fs.Parse(args); err != nil { return err }
	if *env == "" {
		return usageErr("deploy: --env is required")
	}

	slog.Info("deploying", "env", *env, "dry_run", *dryRun)
	// ... real work
	return nil
}

func cmdStatus(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("status", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	asJSON := fs.Bool("json", false, "emit JSON instead of text")
	if err := fs.Parse(args); err != nil { return err }

	if *asJSON {
		fmt.Fprintln(os.Stdout, `{"ok":true}`)
	} else {
		fmt.Fprintln(os.Stdout, "status: ok")
	}
	return nil
}

var subcommands = map[string]subcommand{
	"build":  cmdBuild,
	"deploy": cmdDeploy,
	"status": cmdStatus,
}

// ---------- top-level dispatch ----------

func printGlobalHelp() {
	fmt.Fprintf(os.Stderr,
		`usage: my-tool <subcommand> [options]

subcommands:
  build    Build the project
  deploy   Deploy to an environment
  status   Show current status

global options:
  -h, --help    Show this help

run 'my-tool <subcommand> --help' for subcommand options
`)
}

func main() {
	if len(os.Args) < 2 {
		printGlobalHelp()
		os.Exit(exitUsage)
	}

	sub := os.Args[1]
	switch sub {
	case "-h", "--help", "help":
		printGlobalHelp()
		os.Exit(exitOK)
	}

	handler, ok := subcommands[sub]
	if !ok {
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", sub)
		printGlobalHelp()
		os.Exit(exitUsage)
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := handler(ctx, os.Args[2:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			os.Exit(exitOK)
		}
		var ee *exitError
		if errors.As(err, &ee) {
			fmt.Fprintln(os.Stderr, "error:", ee.Error())
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
