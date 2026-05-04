# Documentation

Same man-page style as the JS/TS versions, with two Go-specific additions: GoDoc on every exported identifier, and `--help` output that follows the Go community conventions (`flag.Usage` style).

## File location

For a single-binary tool, put a man-page-style doc in `README.md`. For a package also imported as a library, add a `doc.go` file with a package-level GoDoc comment.

## GoDoc on exports

Every exported identifier (function, type, constant, method) should start with the identifier's name and read as a complete sentence:

```go
// ParseConfig reads a YAML or JSON config from r and returns a validated
// Config. It returns an error if the input cannot be parsed or fails
// validation.
//
// The config schema is documented at <https://example.com/docs/config>.
func ParseConfig(r io.Reader) (*Config, error) {
	// ...
}
```

Tags worth knowing (Go-specific GoDoc syntax):

- The first sentence is the summary; shows up in `go doc <pkg>` and `pkg.go.dev`.
- Code blocks are indented or wrapped in markdown fences.
- `Deprecated:` at the start of a paragraph marks the API as deprecated.

Run `go doc ./...` locally to preview, or `pkgsite -http=:6060` for full HTML rendering.

## Package-level doc (`doc.go`)

For an importable package, add a `doc.go`:

```go
// Package config loads and validates the my-tool configuration file.
//
// Use Load to read from disk:
//
//	cfg, err := config.Load("./config.yaml")
//
// The package returns a wrapped error from Load on parse failure; use
// errors.Is(err, config.ErrInvalid) to detect schema errors.
package config
```

## Markdown reference (`README.md`)

```markdown
# my-tool

<one-line description>

## Synopsis

\`\`\`
my-tool [global options] <subcommand> [subcommand options]
\`\`\`

## Description

<2-4 sentences. What the tool does. What problem it solves.>

## Subcommands

\`build\`
: Compile the project artifacts.

\`deploy\`
: Deploy to an environment. Requires \`--env\`.

\`status\`
: Print current status as text or JSON.

## Global options

\`-v, --verbose\`
: Enable debug logging on stderr.

\`--version\`
: Print version info and exit.

\`-h, --help\`
: Show help.

## Subcommand: build

### Synopsis

\`\`\`
my-tool build [--env <name>]
\`\`\`

### Options

\`--env <name>\`
: Target environment. Default: \`dev\`. Type: string.

## Exit codes

\`0\` — Success
\`1\` — Generic error
\`2\` — Usage / bad arguments
\`3\` — Input file not found
\`4\` — Network / upstream failure
\`130\` — Killed by SIGINT
\`143\` — Killed by SIGTERM

## Environment variables

\`MY_TOOL_CONFIG\`
: Optional. Path to config file. Default: \`./config.yaml\`.

\`MY_TOOL_DEBUG\`
: Optional. Set to \`1\` to enable debug logging without \`--verbose\`.

## Examples

\`\`\`bash
my-tool build --env staging
my-tool deploy --env prod --dry-run
my-tool status --json
\`\`\`

## Installation

\`\`\`bash
go install github.com/<owner>/<repo>@latest
\`\`\`

Or download a pre-built binary from <https://github.com/<owner>/<repo>/releases>.

## Build from source

\`\`\`bash
git clone https://github.com/<owner>/<repo>
cd <repo>
go build -o my-tool .
\`\`\`

## See also

\`other-tool(1)\`
```

## --help output

The default `flag.Usage` output is fine for simple CLIs:

```
Usage of my-tool:
  -c int
        number of items (default 10)
  -o string
        output file
  -v    enable debug logging
```

For a polished CLI with examples and exit codes, override `fs.Usage`:

```go
fs.Usage = func() {
	fmt.Fprintf(os.Stderr, "usage: my-tool [options] <input>\n\n")
	fmt.Fprintf(os.Stderr, "  Process the input file and emit normalized output.\n\n")
	fmt.Fprintf(os.Stderr, "options:\n")
	fs.PrintDefaults()
	fmt.Fprintf(os.Stderr, "\nexamples:\n")
	fmt.Fprintf(os.Stderr, "  my-tool input.csv\n")
	fmt.Fprintf(os.Stderr, "  cat input.csv | my-tool -\n\n")
	fmt.Fprintf(os.Stderr, "exit codes: 0=ok, 1=error, 2=usage, 130=interrupt\n")
}
```

For cobra/urfave-cli CLIs, the framework generates the help — customize via the framework's API.

## When to skip the long doc

For one-off scripts (single dev, lifetime measured in days), skip the formal doc and put a top-of-file comment block:

```go
// count-lines counts non-empty lines in a file.
//
// Usage:
//   go run count-lines.go <file>
//   ./count-lines <file>
//
// Exit codes:
//   0 — success
//   1 — generic error
//   2 — usage
package main
```

For anything committed to a shared repo or invoked from CI — write the full doc.

## Generated docs

For library packages, `pkg.go.dev` generates HTML from GoDoc comments automatically once the module is published. No extra tooling needed.

For internal docs, `pkgsite -http=:6060` runs the same renderer locally.

For man pages, cobra has `cobra.GenManTree` to generate them from CLI definitions. Useful for system-installed tools.
