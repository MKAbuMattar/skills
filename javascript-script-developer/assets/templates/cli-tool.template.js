#!/usr/bin/env node
/**
 * <tool-name> — multi-subcommand CLI tool.
 *
 * usage: <tool-name> <subcommand> [options]
 *
 * subcommands:
 *   build    Build the project
 *   deploy   Deploy to an environment
 *   status   Show current status
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import process from "node:process";

let verbose = false;
const log = {
  debug: (...a) => verbose && process.stderr.write(`[debug] ${a.join(" ")}\n`),
  info: (...a) => process.stderr.write(`[info] ${a.join(" ")}\n`),
  warn: (...a) => process.stderr.write(`[warn] ${a.join(" ")}\n`),
  error: (...a) => process.stderr.write(`[error] ${a.join(" ")}\n`),
};

class UsageError extends Error {
  constructor(msg) {
    super(msg);
    this.exitCode = 2;
  }
}

// ---------- subcommands ----------

async function cmdBuild(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      env: { type: "string", default: "dev" },
      verbose: { type: "boolean", short: "v" },
    },
    strict: true,
  });
  if (values.verbose) verbose = true;
  log.info(`building for env=${values.env}`);
  // ... real work
  return 0;
}

async function cmdDeploy(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      env: { type: "string" },
      "dry-run": { type: "boolean" },
      verbose: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (values.verbose) verbose = true;
  if (!values.env) throw new UsageError("deploy: --env is required");
  log.info(
    `deploying to ${values.env}${values["dry-run"] ? " (dry-run)" : ""}`,
  );
  // ... real work
  return 0;
}

async function cmdStatus(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      json: { type: "boolean" },
      verbose: { type: "boolean", short: "v" },
    },
    strict: true,
  });
  if (values.verbose) verbose = true;
  const status = { ok: true, uptime: process.uptime() };
  if (values.json) {
    process.stdout.write(JSON.stringify(status) + "\n");
  } else {
    process.stdout.write(`status: ${status.ok ? "ok" : "fail"}\n`);
  }
  return 0;
}

const SUBCOMMANDS = {
  build: cmdBuild,
  deploy: cmdDeploy,
  status: cmdStatus,
};

// ---------- top-level dispatch ----------

function printHelp() {
  process.stderr.write(
    [
      "usage: <tool-name> <subcommand> [options]",
      "",
      "subcommands:",
      "  build    Build the project",
      "  deploy   Deploy to an environment",
      "  status   Show current status",
      "",
      "global options:",
      "  -h, --help        show this help",
      "  -v, --verbose     enable debug logging",
      "",
      "run `<tool-name> <subcommand> --help` for subcommand options",
      "",
    ].join("\n"),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    return 0;
  }

  const sub = argv[0];
  const rest = argv.slice(1);

  const handler = SUBCOMMANDS[sub];
  if (!handler) {
    throw new UsageError(
      `unknown subcommand: ${sub} (try one of: ${Object.keys(SUBCOMMANDS).join(", ")})`,
    );
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    log.info("interrupted");
    process.exit(130);
  });
  if (process.platform !== "win32") {
    process.on("SIGTERM", () => {
      log.info("terminated");
      process.exit(143);
    });
  }

  return handler(rest);
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
