# Documentation

Same man-page style as the JavaScript version, with two TypeScript-specific additions: TSDoc on public APIs, and explicit type signatures in the help / usage section when types add information.

## File location

For a single-file script `my-script.ts`, put the doc next to it as `my-script.md`. For a `package.json`-based tool with `bin`, put the doc in `README.md`.

## TSDoc on public APIs

Use TSDoc (`/** */` blocks) on every exported function, type, and class. The TypeScript Language Server picks them up; IDEs show them on hover.

```ts
/**
 * Parse a CSV file and return summary statistics for numeric columns.
 *
 * @param input - Path to a CSV file, or `-` to read from stdin.
 * @param opts - Parsing options.
 * @returns Per-column statistics; non-numeric columns omitted.
 * @throws {InputError} If the file cannot be read.
 * @throws {ParseError} If a row has the wrong number of fields.
 *
 * @example
 * ```ts
 * const stats = await analyze("data.csv", { delimiter: "," });
 * for (const [col, s] of Object.entries(stats)) {
 *   console.log(col, s.mean);
 * }
 * ```
 */
export async function analyze(
  input: string,
  opts: ParseOptions = {},
): Promise<Statistics> {
  // ...
}
```

Tags worth knowing:

- `@param` — parameter description.
- `@returns` — return value description.
- `@throws` — exceptions thrown.
- `@example` — runnable example block.
- `@deprecated` — mark deprecated APIs (`@deprecated Use X instead.`).
- `@internal` — public-by-syntax but not part of the documented API.

## Markdown reference (man-page style)

```markdown
# my-script

<one-line description>

## Synopsis

\`\`\`
my-script [options] <input>
\`\`\`

## Description

<2-4 sentences. What the script does. What problem it solves.>

## Options

\`-o, --output <path>\`
:   Output file path. Defaults to stdout. Type: \`string\`.

\`-c, --count <n>\`
:   Process first N items. Default: \`10\`. Type: \`number\` (positive integer).

\`-v, --verbose\`
:   Enable debug logging on stderr. Type: \`boolean\`.

\`-h, --help\`
:   Show this help.

## Arguments

\`input\`
:   Path to the input file. Use \`-\` for stdin. Type: \`string\`.

## Exit codes

\`0\` — Success
\`1\` — Generic error
\`2\` — Usage / bad arguments
\`3\` — Input file not found or unreadable
\`4\` — Network / upstream failure
\`130\` — Killed by SIGINT

## Environment variables

\`API_KEY\` (required)
:   Authentication token. Type: \`string\`.

\`CONFIG_PATH\` (optional, default \`./config.json\`)
:   Path to config file. Type: \`string\`.

\`DEBUG\` (optional, default \`0\`)
:   Set to \`1\` to enable debug logging. Type: \`"0" | "1"\`.

## Examples

\`\`\`bash
# Run via tsx (development)
npx tsx src/my-script.ts data.csv

# Run via Bun
bun run src/my-script.ts data.csv

# After build (tsc)
node dist/my-script.js data.csv

# Installed globally as bin
my-script data.csv
\`\`\`

## Requirements

- Node.js 20 or newer
- TypeScript 5.4 or newer (build only)
- \`API_KEY\` environment variable

## Files

\`./config.json\`
:   Optional config file read at startup. Schema in \`src/config.ts\`.

## See also

\`other-tool(1)\`
```

## --help output

The script's `--help` output should be a condensed version. Don't dump the full doc.

```
usage: my-script [options] <input>

  Process input.csv and emit normalized output.

options:
  -o, --output <path>   output file path (default: stdout)
  -c, --count <n>       process first N items (default: 10)
  -v, --verbose         enable debug logging
  -h, --help            show this help

types:
  --output  string
  --count   positive integer

examples:
  my-script input.csv
  cat input.csv | my-script -

exit codes: 0=ok, 1=error, 2=usage, 3=input, 130=interrupt
```

The `types:` section is optional but useful for typed CLIs — it tells the user the expected shape of values.

## When to skip the long doc

For one-off scripts (run by a single dev, lifetime measured in days), skip the formal `.md` doc and put a TSDoc block at the top of the file instead:

```ts
/**
 * count-chars — count characters in a file.
 *
 * Usage: tsx count-chars.ts <file>
 *
 * Exit codes:
 *   0 — success
 *   1 — generic error
 *   2 — usage
 *
 * @example
 * ```bash
 * npx tsx count-chars.ts input.txt
 * ```
 */
```

For anything that gets committed to a shared repo, used by more than one person, or invoked from CI — write the full doc.

## Generating reference docs

If the script also exposes a library API:

- `typedoc` — generates HTML docs from TSDoc comments. Standard for npm packages.
- `api-extractor` — generates a single-file API report; good for reviewing API surface in PRs.

Neither is needed for pure scripts.
