#!/usr/bin/env node
/**
 * <one-line description>.
 *
 * <longer description if needed>
 *
 * usage: <script-name> [options] <input>
 * exit:  0 ok, 1 generic, 2 usage, 130 interrupt
 */
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- logging ----------

let verbose = false;
const log = {
  debug: (...a) => verbose && process.stderr.write(`[debug] ${a.join(" ")}\n`),
  info: (...a) => process.stderr.write(`[info] ${a.join(" ")}\n`),
  warn: (...a) => process.stderr.write(`[warn] ${a.join(" ")}\n`),
  error: (...a) => process.stderr.write(`[error] ${a.join(" ")}\n`),
};

// ---------- error classes ----------

class UsageError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "UsageError";
    this.exitCode = 2;
  }
}

class InputError extends Error {
  constructor(msg, { path } = {}) {
    super(msg);
    this.name = "InputError";
    this.path = path;
    this.exitCode = 3;
  }
}

// ---------- arg parsing ----------

function parseCliArgs() {
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
    input: positionals[0],
    output: values.output,
    verbose: values.verbose ?? false,
  };
}

function printHelp() {
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

async function run({ input, output }) {
  log.info(`processing ${input}`);

  // Replace this with the actual work:
  const content = await readFile(input, "utf8").catch((err) => {
    if (err.code === "ENOENT") {
      throw new InputError(`input file not found: ${input}`, { path: input });
    }
    throw err;
  });

  log.debug(`read ${content.length} bytes`);
  const result = content; // ← real transformation goes here

  if (output) {
    await writeFile(output, result);
    log.info(`wrote ${output}`);
  } else {
    process.stdout.write(result);
  }
}

// ---------- main ----------

async function main() {
  const args = parseCliArgs();
  verbose = args.verbose;
  log.debug("args:", JSON.stringify(args));

  // Graceful shutdown
  const onSignal = (sig) => {
    log.info(`received ${sig}, shutting down`);
    process.exit(130);
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  if (process.platform !== "win32") {
    process.on("SIGTERM", () => onSignal("SIGTERM"));
  }

  await run(args);
  return 0;
}

// ---------- entrypoint ----------

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      if (err.exitCode != null) {
        log.error(err.message);
        process.exit(err.exitCode);
      }
      log.error("unexpected:", err.stack ?? err.message);
      process.exit(1);
    });
}
