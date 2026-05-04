#!/usr/bin/env node
/**
 * <one-line description>.
 *
 * Usage: tsx script.ts [options] <input>
 *
 * Exit codes:
 *   0 — success
 *   1 — generic error
 *   2 — usage / bad arguments
 *   3 — input not found / unreadable
 *   130 — killed by SIGINT
 */
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ---------- types ----------

interface CliArgs {
  readonly input: string;
  readonly output: string | undefined;
  readonly verbose: boolean;
}

// ---------- error classes ----------

abstract class ScriptError extends Error {
  abstract readonly kind: string;
  abstract readonly exitCode: number;
}

class UsageError extends ScriptError {
  readonly kind = "usage" as const;
  readonly exitCode = 2;
}

class InputError extends ScriptError {
  readonly kind = "input" as const;
  readonly exitCode = 3;
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
  }
}

// ---------- logger ----------

let verbose = false;
const log = {
  debug: (...a: readonly unknown[]): void => {
    if (verbose) process.stderr.write(`[debug] ${formatArgs(a)}\n`);
  },
  info: (...a: readonly unknown[]): void =>
    process.stderr.write(`[info] ${formatArgs(a)}\n`),
  warn: (...a: readonly unknown[]): void =>
    process.stderr.write(`[warn] ${formatArgs(a)}\n`),
  error: (...a: readonly unknown[]): void =>
    process.stderr.write(`[error] ${formatArgs(a)}\n`),
} as const;

function formatArgs(args: readonly unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}

// ---------- arg parsing ----------

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string", short: "o" },
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (positionals.length !== 1) {
    throw new UsageError("expected exactly one positional argument: <input>");
  }

  return {
    input: positionals[0]!,
    output: values.output,
    verbose: values.verbose ?? false,
  };
}

function printHelp(): void {
  process.stderr.write(
    [
      "usage: <script-name> [options] <input>",
      "",
      "  <one-line description>",
      "",
      "options:",
      "  -o, --output <path>   output file path (default: stdout)",
      "  -v, --verbose         enable debug logging",
      "  -h, --help            show this help",
      "",
    ].join("\n"),
  );
}

// ---------- main work ----------

async function run(args: CliArgs): Promise<void> {
  log.info(`processing ${args.input}`);

  const content = await readFile(args.input, "utf8").catch((err: unknown) => {
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new InputError(`input not found: ${args.input}`, args.input);
    }
    throw err;
  });

  log.debug(`read ${content.length} bytes`);

  // Replace with the actual transformation:
  const result: string = content;

  if (args.output !== undefined) {
    await writeFile(args.output, result);
    log.info(`wrote ${args.output}`);
  } else {
    process.stdout.write(result);
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// ---------- main ----------

async function main(): Promise<number> {
  const args = parseCliArgs();
  verbose = args.verbose;
  log.debug("args:", args);

  process.on("SIGINT", () => process.exit(130));
  if (process.platform !== "win32") {
    process.on("SIGTERM", () => process.exit(143));
  }

  await run(args);
  return 0;
}

// ---------- entrypoint ----------

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err: unknown) => {
      if (err instanceof ScriptError) {
        log.error(err.message);
        process.exit(err.exitCode);
      }
      log.error("unexpected:", err instanceof Error ? err.stack : err);
      process.exit(1);
    });
}
