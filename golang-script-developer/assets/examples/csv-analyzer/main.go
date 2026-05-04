// Package main implements csv-analyzer: read a CSV and summarize numeric columns.
//
// Reads a CSV file (or stdin), parses each row, and prints summary statistics
// (count, min, max, mean, stddev) for each numeric column. Skips non-numeric
// columns. Supports gzip-compressed input.
//
// Usage: csv-analyzer [options] <input>
//
// Exit codes:
//
//	0   — success
//	1   — generic error
//	2   — bad arguments
//	3   — input not found / unreadable
//	4   — parse error
//	130 — interrupted
package main

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
)

// ---------- exit codes ----------

const (
	exitOK        = 0
	exitGeneric   = 1
	exitUsage     = 2
	exitInput     = 3
	exitParse     = 4
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
func inputErr(format string, a ...any) error {
	return &exitError{code: exitInput, err: fmt.Errorf(format, a...)}
}
func parseErr(format string, a ...any) error {
	return &exitError{code: exitParse, err: fmt.Errorf(format, a...)}
}

// ---------- args ----------

type args struct {
	input     string
	delimiter rune
	hasHeader bool
	asJSON    bool
	verbose   bool
}

func parseArgs() (args, error) {
	fs := flag.NewFlagSet("csv-analyzer", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	delim := fs.String("d", ",", "field delimiter (single character)")
	noHeader := fs.Bool("no-header", false, "treat first row as data")
	asJSON := fs.Bool("json", false, "emit JSON instead of human-readable")
	verbose := fs.Bool("v", false, "enable debug logging")

	fs.Usage = func() {
		fmt.Fprintf(os.Stderr,
			`usage: csv-analyzer [options] <input>

  Read a CSV, print summary stats for numeric columns.
  Use - as input to read from stdin.

options:
`)
		fs.PrintDefaults()
		fmt.Fprintf(os.Stderr,
			`
examples:
  csv-analyzer data.csv
  cat data.csv.gz | csv-analyzer -
  csv-analyzer --json --no-header data.tsv -d $'\t'

exit codes: 0=ok, 1=error, 2=usage, 3=input, 4=parse, 130=interrupt
`)
	}

	if err := fs.Parse(os.Args[1:]); err != nil {
		return args{}, err
	}
	if fs.NArg() != 1 {
		return args{}, usageErr("expected exactly one positional argument: <input> (use - for stdin)")
	}
	if len([]rune(*delim)) != 1 {
		return args{}, usageErr("--delimiter must be a single character")
	}

	return args{
		input:     fs.Arg(0),
		delimiter: []rune(*delim)[0],
		hasHeader: !*noHeader,
		asJSON:    *asJSON,
		verbose:   *verbose,
	}, nil
}

// ---------- streaming input ----------

func openInput(path string) (io.ReadCloser, error) {
	if path == "-" {
		return io.NopCloser(os.Stdin), nil
	}
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, inputErr("input not found: %s", path)
		}
		return nil, fmt.Errorf("stat: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, inputErr("input is not a regular file: %s", path)
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	if strings.HasSuffix(path, ".gz") {
		gz, err := gzip.NewReader(f)
		if err != nil {
			_ = f.Close()
			return nil, parseErr("gzip: %w", err)
		}
		return &gzipReadCloser{gz: gz, f: f}, nil
	}
	return f, nil
}

type gzipReadCloser struct {
	gz *gzip.Reader
	f  *os.File
}

func (g *gzipReadCloser) Read(p []byte) (int, error) { return g.gz.Read(p) }
func (g *gzipReadCloser) Close() error {
	gerr := g.gz.Close()
	ferr := g.f.Close()
	if gerr != nil {
		return gerr
	}
	return ferr
}

// ---------- CSV parsing (RFC-4180 lite) ----------

func parseLine(line string, delim rune) []string {
	var out []string
	var buf strings.Builder
	inQuotes := false
	runes := []rune(line)
	for i := 0; i < len(runes); i++ {
		c := runes[i]
		switch {
		case inQuotes:
			if c == '"' {
				if i+1 < len(runes) && runes[i+1] == '"' {
					buf.WriteRune('"')
					i++
				} else {
					inQuotes = false
				}
			} else {
				buf.WriteRune(c)
			}
		case c == '"':
			inQuotes = true
		case c == delim:
			out = append(out, buf.String())
			buf.Reset()
		default:
			buf.WriteRune(c)
		}
	}
	out = append(out, buf.String())
	return out
}

// ---------- streaming statistics (Welford) ----------

type runningStats struct {
	n        int64
	mean, m2 float64
	min, max float64
}

func newRunningStats() *runningStats {
	return &runningStats{min: math.Inf(1), max: math.Inf(-1)}
}

func (r *runningStats) push(x float64) {
	r.n++
	if x < r.min {
		r.min = x
	}
	if x > r.max {
		r.max = x
	}
	delta := x - r.mean
	r.mean += delta / float64(r.n)
	r.m2 += delta * (x - r.mean)
}

func (r *runningStats) stddev() float64 {
	if r.n < 2 {
		return 0
	}
	return math.Sqrt(r.m2 / float64(r.n-1))
}

// ---------- analysis ----------

type columnStats struct {
	Count  int64   `json:"count"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
	Mean   float64 `json:"mean"`
	Stddev float64 `json:"stddev"`
}

type analysisResult struct {
	header   []string
	stats    []*runningStats
	dataRows int64
}

func analyze(ctx context.Context, a args, in io.Reader) (*analysisResult, error) {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024) // 4 MB max line
	var header []string
	var stats []*runningStats
	var rowNum int64
	var dataRows int64

	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		rowNum++
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		fields := parseLine(line, a.delimiter)

		if rowNum == 1 && a.hasHeader {
			header = fields
			stats = make([]*runningStats, len(fields))
			for i := range stats {
				stats[i] = newRunningStats()
			}
			slog.Info("columns", "names", strings.Join(fields, ","))
			continue
		}
		if stats == nil {
			header = make([]string, len(fields))
			for i := range header {
				header[i] = fmt.Sprintf("col%d", i+1)
			}
			stats = make([]*runningStats, len(fields))
			for i := range stats {
				stats[i] = newRunningStats()
			}
		}
		if len(fields) != len(stats) {
			return nil, parseErr("row %d: expected %d fields, got %d", rowNum, len(stats), len(fields))
		}
		for i, f := range fields {
			if v, err := strconv.ParseFloat(f, 64); err == nil {
				stats[i].push(v)
			}
		}
		dataRows++
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}

	return &analysisResult{
		header:   header,
		stats:    stats,
		dataRows: dataRows,
	}, nil
}

// ---------- output ----------

func emitHuman(result *analysisResult) {
	fmt.Fprintf(os.Stderr, "\n%d data rows\n\n", result.dataRows)
	fmt.Fprintln(os.Stdout, "column\tcount\tmin\tmax\tmean\tstddev")
	for i, name := range result.header {
		s := result.stats[i]
		if s.n == 0 {
			continue
		}
		fmt.Fprintf(os.Stdout, "%s\t%d\t%.4f\t%.4f\t%.4f\t%.4f\n",
			name, s.n, s.min, s.max, s.mean, s.stddev())
	}
}

func emitJSON(result *analysisResult) error {
	out := struct {
		Rows    int64                  `json:"rows"`
		Columns map[string]columnStats `json:"columns"`
	}{
		Rows:    result.dataRows,
		Columns: make(map[string]columnStats),
	}
	for i, name := range result.header {
		s := result.stats[i]
		if s.n == 0 {
			continue
		}
		out.Columns[name] = columnStats{
			Count: s.n, Min: s.min, Max: s.max, Mean: s.mean, Stddev: s.stddev(),
		}
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(out)
}

// ---------- main ----------

func run(ctx context.Context, a args) error {
	rc, err := openInput(a.input)
	if err != nil {
		return err
	}
	defer rc.Close()

	result, err := analyze(ctx, a, rc)
	if err != nil {
		return err
	}

	if a.asJSON {
		return emitJSON(result)
	}
	emitHuman(result)
	return nil
}

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

	level := slog.LevelInfo
	if a.verbose {
		level = slog.LevelDebug
	}
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
