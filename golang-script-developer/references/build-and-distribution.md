# Build and distribution

Load this when shipping a Go program — single-binary install, multi-arch release, container image, package manager.

## `go build` for development

```bash
go build -o my-tool .              # binary in cwd
go build -o ./bin/my-tool .        # binary in ./bin
go run .                            # build and run, no binary kept
go run main.go input.csv            # one-file run
```

For a watch loop during development, use `air` (`github.com/air-verse/air`) or `entr` for shell-level watching.

## Build flags

| Flag               | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `-ldflags="-s -w"` | Strip debug info; ~30% smaller binary                         |
| `-trimpath`        | Remove file system paths from binary; for reproducible builds |
| `-buildvcs=false`  | Skip embedding VCS info                                       |
| `-tags="<tags>"`   | Activate build tags                                           |
| `-race`            | Enable the race detector (dev only)                           |

Production release build:

```bash
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=$(git rev-parse --short HEAD)" -o my-tool .
```

## Embedding version info

```go
package main

var (
	version = "dev"      // overridden by -ldflags="-X main.version=..."
	commit  = "unknown"
	date    = "unknown"
)

func printVersion() {
	fmt.Printf("my-tool %s (%s, %s)\n", version, commit, date)
}
```

Build:

```bash
go build -ldflags="-X main.version=v1.2.3 -X main.commit=$(git rev-parse --short HEAD) -X main.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" -o my-tool .
```

For more polish, use `runtime/debug.ReadBuildInfo()` (Go 1.18+) which automatically includes git info if `-buildvcs=true` (the default):

```go
import "runtime/debug"

func printVersion() {
	if info, ok := debug.ReadBuildInfo(); ok {
		var rev, time string
		for _, s := range info.Settings {
			switch s.Key {
			case "vcs.revision": rev = s.Value
			case "vcs.time":     time = s.Value
			}
		}
		fmt.Printf("my-tool %s (%s, %s)\n", info.Main.Version, rev, time)
	}
}
```

## Cross-compile matrix

```bash
#!/usr/bin/env bash
set -euo pipefail
TARGETS=(
	"linux amd64"
	"linux arm64"
	"darwin amd64"
	"darwin arm64"
	"windows amd64"
)
for target in "${TARGETS[@]}"; do
	read -r os arch <<<"$target"
	out="my-tool-${os}-${arch}"
	[[ "$os" == "windows" ]] && out="${out}.exe"
	echo "Building $out..."
	GOOS="$os" GOARCH="$arch" CGO_ENABLED=0 \
		go build -trimpath -ldflags="-s -w" -o "dist/$out" .
done
```

For richer release pipelines: `goreleaser` (the de-facto standard).

## GoReleaser

`goreleaser` automates: build for N platforms, package as tar/zip, generate checksums, create GitHub Releases, build Docker images, sign binaries.

Minimal `.goreleaser.yaml`:

```yaml
version: 2
project_name: my-tool

builds:
  - id: my-tool
    main: ./
    binary: my-tool
    env: [CGO_ENABLED=0]
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]
    flags: [-trimpath]
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
      - -X main.commit={{.Commit}}
      - -X main.date={{.Date}}

archives:
  - format: tar.gz
    format_overrides:
      - goos: windows
        format: zip
    name_template: "{{.ProjectName}}_{{.Os}}_{{.Arch}}"

checksum:
  name_template: "checksums.txt"

release:
  github:
    owner: <owner>
    name: <repo>
```

Run: `goreleaser release --clean` from a tagged commit.

## Container image (multi-stage Dockerfile)

```dockerfile
# Build stage
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/my-tool .

# Runtime stage — minimal scratch image
FROM scratch
COPY --from=build /out/my-tool /my-tool
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
ENTRYPOINT ["/my-tool"]
```

For programs that need DNS resolution / time zones, swap `scratch` for `gcr.io/distroless/static-debian12` — same minimal idea, includes the bits CGO-less Go programs typically need.

## Installing for users

### `go install`

If your repo is on a public Git host with `go.mod`:

```bash
go install github.com/owner/my-tool@latest
go install github.com/owner/my-tool@v1.2.3
```

This builds and installs into `$GOBIN` (default `~/go/bin`). The user needs Go.

### Pre-built binaries

For users without Go, ship pre-built binaries via:

- GitHub Releases with the binaries attached (manual or via goreleaser).
- A package manager: Homebrew tap, AUR, scoop bucket, deb/rpm.

GoReleaser can publish to all of these from one config.

## Static binaries

For Linux containers and minimal images, you want a fully-static binary:

```bash
CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o my-tool .
file my-tool
# my-tool: ELF 64-bit LSB executable, x86-64, statically linked, ...
```

`CGO_ENABLED=0` is the key. Any cgo dependency requires a C toolchain and dynamic libc.

## Reproducible builds

Two flags make the output deterministic:

- `-trimpath` — strips local filesystem paths.
- `-buildvcs=false` — skips embedding VCS state (or pin the VCS state explicitly).

Plus pinned dependencies (`go.sum` committed) and a fixed Go version (`go` directive in `go.mod`).

```bash
go build -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o my-tool .
```

The `-buildid=` clears the build ID, the last source of nondeterminism.

## Choosing a Go version floor

| Floor | Reason                                               |
| ----- | ---------------------------------------------------- |
| 1.21  | `log/slog` in stdlib                                 |
| 1.22  | Loop variable scoping fix; `http.ServeMux` patterns  |
| 1.23  | Iterators (`range over func`); `slices` enhancements |
| 1.24  | `tool` directive in `go.mod`; experimental synctest  |

For new tools, target the active major (currently 1.23). `go 1.23` in `go.mod` makes `go build` reject older toolchains.

## When `go install` isn't enough

For binaries with non-Go assets (templates, configs, locale files), embed them with `//go:embed`. That makes the binary self-contained and `go install`-able without a separate "data" install step.

If embedding isn't an option (genuinely huge data files), ship via the package manager / release tarball instead.
