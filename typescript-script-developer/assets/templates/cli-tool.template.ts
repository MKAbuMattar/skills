#!/usr/bin/env node
/**
 * <tool-name> — multi-subcommand CLI tool.
 *
 * Usage: tsx cli.ts <subcommand> [options]
 *
 * Subcommands:
 *   build    Build the project
 *   deploy   Deploy to an environment
 *   status   Show current status
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ---------- types ----------

type SubcommandName = "build" | "deploy" | "status";
type Subcommand = (argv: readonly string[]) => Promise<number>;

// ---------- error classes ----------

abstract class ScriptError extends Error {
  abstract readonly kind: string;
  abstract readonly exitCode: number;
}

class UsageError extends ScriptError {
  readonly kind = "usage" as const;
  readonly exitCode = 2;
}

// ---------- logger ----------

let verbose = false;
const log = {
  debug: (...a: readonly unknown[]): void => {
    if (verbose) process.stderr.write(`[debug] ${a.join(" ")}\n`);
  },
  info: (...a: readonly unknown[]): void =>
    process.stderr.write(`[info] ${a.join(" ")}\n`),
  warn: (...a: readonly unknown[]): void =>
    process.stderr.write(`[warn] ${a.join(" ")}\n`),
  error: (...a: readonly unknown[]): void =>
    process.stderr.write(`[error] ${a.join(" ")}\n`),
} as const;

// ---------- subcommands ----------

const cmdBuild: Subcommand = async (argv) => {
  const { values } = parseArgs({
    args: [...argv],
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
};

const cmdDeploy: Subcommand = async (argv) => {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      env: { type: "string" },
      "dry-run": { type: "boolean" },
      verbose: { type: "boolean", short: "v" },
    },
    strict: true,
  });
  if (values.verbose) verbose = true;
  if (values.env === undefined)
    throw new UsageError("deploy: --env is required");
  log.info(
    `deploying to ${values.env}${values["dry-run"] ? " (dry-run)" : ""}`,
  );
  // ... real work
  return 0;
};

const cmdStatus: Subcommand = async (argv) => {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      json: { type: "boolean" },
      verbose: { type: "boolean", short: "v" },
    },
    strict: true,
  });
  if (values.verbose) verbose = true;
  const status = { ok: true, uptime: process.uptime() } as const;
  if (values.json) {
    process.stdout.write(`${JSON.stringify(status)}\n`);
  } else {
    process.stdout.write(`status: ${status.ok ? "ok" : "fail"}\n`);
  }
  return 0;
};

const SUBCOMMANDS: Readonly<Record<SubcommandName, Subcommand>> = {
  build: cmdBuild,
  deploy: cmdDeploy,
  status: cmdStatus,
};

function isSubcommandName(s: string): s is SubcommandName {
  return s in SUBCOMMANDS;
}

// ---------- top-level dispatch ----------

function printHelp(): void {
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

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const first = argv[0];
  if (first === undefined || first === "-h" || first === "--help") {
    printHelp();
    return 0;
  }

  if (!isSubcommandName(first)) {
    throw new UsageError(
      `unknown subcommand: ${first} (try one of: ${Object.keys(SUBCOMMANDS).join(", ")})`,
    );
  }

  process.on("SIGINT", () => process.exit(130));
  if (process.platform !== "win32") {
    process.on("SIGTERM", () => process.exit(143));
  }

  return SUBCOMMANDS[first](argv.slice(1));
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
