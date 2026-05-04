# Documentation

Load this when generating reference docs for a script. Use the AWS CLI / man page style — terse, scannable, examples at the end.

## File location

For a single-file script `my-script.js`, put the doc next to it as `my-script.md`. For a `package.json`-based tool with `bin`, put the doc in `README.md`.

## Template

```markdown
# my-script

<one-line description>

## Synopsis

\`\`\`
my-script [options] <input>
\`\`\`

## Description

<2-4 sentences. What the script does. What problem it solves. When to reach for it vs. alternatives.>

## Options

\`-o, --output <path>\`
: Output file path. Defaults to stdout.

\`-v, --verbose\`
: Enable debug logging on stderr.

\`-c, --count <n>\`
: Process first N items. Default: 10.

\`-h, --help\`
: Show this help.

## Arguments

\`input\`
: Path to the input file. Use \`-\` for stdin.

## Exit codes

\`0\` — Success
\`1\` — Generic error
\`2\` — Usage / bad arguments
\`3\` — Input file not found or unreadable
\`4\` — Network failure
\`130\` — Killed by SIGINT

## Environment variables

\`API_KEY\`
: Required. Authentication token for the upstream service.

\`CONFIG_PATH\`
: Optional. Path to config file. Default: \`./config.json\`.

\`DEBUG\`
: Optional. Set to \`1\` to enable debug logging without \`--verbose\`.

## Examples

Process a single file:

\`\`\`bash
my-script input.json
\`\`\`

Process from stdin, write to a file:

\`\`\`bash
cat input.json | my-script - --output result.json
\`\`\`

With verbose logging:

\`\`\`bash
my-script -v input.json 2>debug.log
\`\`\`

## Requirements

- Node.js 20 or newer
- \`API_KEY\` environment variable

## Files

\`./config.json\`
: Optional config file read at startup.

\`~/.cache/my-script/\`
: Cache directory. Created on first run.

## See also

\`other-tool(1)\`
```

## Conventions

- **Synopsis uses BNF-ish syntax.** `<required>`, `[optional]`, `[options]` for "any options".
- **Options block has both forms** (short and long), separated by a comma. Argument types in `<angle brackets>`.
- **Exit codes section names every distinct code** the script can return. Don't say "non-zero on error" without enumerating.
- **Environment variables section says required vs. optional explicitly.** And the default if there is one.
- **Examples are runnable** — the user can copy-paste them. Show realistic input, not `foo bar baz`.
- **Files section** lists every file the script reads, writes, or expects to exist. Including the cache directory.

## --help output

The script's `--help` output should be a condensed version of the doc — usage line, one-line description per option, examples. Don't dump the full man-page-style content into stderr.

```
usage: my-script [options] <input>

  Process input.json and emit normalized output.

options:
  -o, --output <path>   output file path (default: stdout)
  -c, --count <n>       process first N items (default: 10)
  -v, --verbose         enable debug logging
  -h, --help            show this help

examples:
  my-script input.json
  cat input.json | my-script -

exit codes: 0=ok, 1=error, 2=usage, 3=input, 130=interrupt
```

## When to skip the doc

For one-off scripts (a helper for a single dev, lifetime measured in days), skip the formal doc and put a 5-line comment block at the top of the file instead:

```js
/**
 * Counts characters in a file.
 *
 * usage: count-chars <file>
 * exit: 0 ok, 1 generic, 2 usage
 */
```

For anything that gets committed to a shared repo, used by more than one person, or invoked from CI — write the full doc.
