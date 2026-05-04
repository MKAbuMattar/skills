# Anti-patterns

Load this when reviewing or rewriting an existing Go program. Each entry names a pattern to remove and the better alternative.

## `panic` for non-programmer errors

Bad: `panic(err)` when a file is missing or a network call fails. Crashes ungracefully, no recovery, no exit code control.

Good: return the error, let `main` decide. Reserve `panic` for programmer errors (impossible-state assertions, "this should never happen" branches).

```go
// bad
data, err := os.ReadFile(path)
if err != nil { panic(err) }

// good
data, err := os.ReadFile(path)
if err != nil { return fmt.Errorf("read %q: %w", path, err) }
```

## Ignoring errors with `_`

Bad: `_ = json.Unmarshal(data, &result)` — silently ignores errors, hides bugs.

Good: handle the error or, if genuinely safe to ignore, document why with a comment.

The only legitimate `_` for an error is on `defer` calls where you've already handled the primary path:

```go
defer func() {
	_ = file.Close() // already wrote and synced; close error is informational
}()
```

## `fmt.Errorf("...: %s", err)` instead of `%w`

Bad: `fmt.Errorf("read failed: %s", err)` — drops the chain. `errors.Is`/`errors.As` no longer work.

Good: `fmt.Errorf("read failed: %w", err)`. Preserves the chain.

## `time.Now()` and `os.Stdout` baked into business logic

Bad: a function that calls `time.Now()` directly is hard to test deterministically.

Good: pass dependencies as parameters or struct fields:

```go
type Reporter struct {
	now    func() time.Time
	stdout io.Writer
}

func (r *Reporter) Report() {
	fmt.Fprintf(r.stdout, "report at %s\n", r.now().Format(time.RFC3339))
}

// production
r := &Reporter{now: time.Now, stdout: os.Stdout}
// test
r := &Reporter{now: func() time.Time { return testTime }, stdout: &bytes.Buffer{}}
```

## `init()` for non-trivial setup

Bad: `func init()` that opens DB connections, reads files, or registers global state. Hidden side effects; runs at import time; hurts testability.

Good: explicit setup function called from `main`. Pass dependencies down.

`init()` is fine for: registering a stdlib driver (`pq.init`), pre-computing constants, registering with `flag` (rare). Anything with I/O or fallible ops should be explicit.

## Returning `interface{}` / `any`

Bad: `func parse(data []byte) (any, error)` — caller has to type-assert and may guess wrong.

Good: return a concrete type, or use a generic:

```go
func parse[T any](data []byte) (T, error) {
	var v T
	err := json.Unmarshal(data, &v)
	return v, err
}
```

## Loops with closure-captured range vars (pre Go 1.22)

Bad in Go ≤ 1.21: `for _, x := range items { go func() { use(x) }() }` — every goroutine sees the _last_ value of `x`.

Go 1.22+: this is fixed. Each iteration gets its own variable.

Pre-1.22 fix:

```go
for _, x := range items {
	x := x // capture
	go func() { use(x) }()
}
```

If your `go.mod` says `go 1.22` or higher, the fix is unnecessary — but check the language version in `go.mod` before relying on the new behavior.

## `goroutine` leaks

Bad:

```go
go func() {
	for {
		select { case <-ch: ... } // no exit case
	}
}()
```

Good: every long-running goroutine must respect a `context.Context`:

```go
go func() {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			process(msg)
		}
	}
}()
```

If the context isn't available, the goroutine has no escape and leaks for the lifetime of the program.

## `os.Exit` from inside a function (not `main`)

Bad: `os.Exit(1)` deep in a function. Bypasses `defer`, may skip cleanup, makes the function untestable.

Good: return an error. Let `main` call `os.Exit`.

## Sleeping in tests

Bad: `time.Sleep(1 * time.Second)` to wait for async work. Flaky and slow.

Good: `eventually` patterns with channels or `testing/synctest` (Go 1.24+ experimental). Or pass a clock interface and tick it manually.

## `strings.Title` (deprecated)

Bad: `strings.Title(s)` — deprecated in Go 1.18, doesn't handle Unicode correctly.

Good: `golang.org/x/text/cases.Title(language.English).String(s)`. Or, for simple cases, write the small loop yourself.

## Logging via `log` package

Bad: `log.Printf("err: %v", err)` — unstructured, hard to ship to log aggregators, no levels.

Good: `log/slog`:

```go
slog.Error("operation failed", "op", "fetch", "err", err)
```

The standard `log` is fine for tiny one-off scripts. For anything with operational requirements (log levels, structured fields, JSON output), use `slog`.

## `fmt.Println` instead of structured stderr

Bad: `fmt.Println("processing", file)` — pollutes stdout for callers piping the output. Mixes diagnostics with output.

Good: log to stderr via `slog` (default goes to stderr). Reserve stdout for the program's structured output.

## `panic`/`recover` as control flow

Bad: throwing-and-catching panics across function boundaries to short-circuit. Slow and surprising.

Good: errors as values. The whole language is built around them.

## `ioutil` (deprecated)

Bad: `ioutil.ReadFile`, `ioutil.WriteFile`, `ioutil.ReadAll`. Deprecated in Go 1.16.

Good: `os.ReadFile`, `os.WriteFile`, `io.ReadAll`. Same APIs, just moved to better-named packages.

## `interface{}` instead of `any`

Bad: `interface{}` in modern Go (1.18+). Wordy.

Good: `any`. They're identical aliases; `any` is the idiomatic name.

## Missing `defer cancel()` after `context.WithCancel` / `WithTimeout`

Bad:

```go
ctx, cancel := context.WithTimeout(parent, 30*time.Second)
data, err := fetch(ctx, url) // cancel never called
```

Good:

```go
ctx, cancel := context.WithTimeout(parent, 30*time.Second)
defer cancel()
data, err := fetch(ctx, url)
```

`go vet` flags this. Run `go vet ./...` in CI.

## `path` instead of `path/filepath` for filesystem paths

Bad: `path.Join("dir", "file.txt")` for a filesystem path. Always uses `/`. Wrong on Windows.

Good: `filepath.Join("dir", "file.txt")`. Uses the OS separator.

`path` is for URL / embed / forward-slash-only contexts. `path/filepath` is for everything that touches the disk.

## `for { select { ... } }` without timing out the whole loop

Bad: an infinite loop that doesn't respect a deadline. Lives forever even if the work was cancelled.

Good: every loop with a `select` checks `ctx.Done()` first. Always.

## Returning a pointer to a stack-allocated value as if it leaks

Not actually bad — Go's escape analysis handles this. But people new to Go sometimes write:

```go
func newThing() *Thing {
	t := Thing{}
	return &t // OK; escape analysis moves t to the heap
}
```

This is fine. The compiler will heap-allocate `t` because the pointer escapes. Don't add unnecessary `new()` calls "for safety".

## `panic("not implemented")` shipped to production

Bad: scaffolding panics that survive into a release.

Good: track them with a build tag or a lint rule. `go vet` doesn't catch this; consider `golangci-lint`'s `forbidigo` linter or a regex check in CI.
