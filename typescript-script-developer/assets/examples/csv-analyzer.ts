#!/usr/bin/env node
/**
 * csv-analyzer — read a CSV, summarize numeric columns.
 *
 * Reads a CSV file (or stdin), parses each row, and prints summary statistics
 * (count, min, max, mean, stddev) for each numeric column. Skips non-numeric
 * columns. Supports gzip-compressed input.
 *
 * Usage: tsx csv-analyzer.ts [options] <input>
 *
 * Exit codes:
 *   0   — success
 *   1   — generic error
 *   2   — bad arguments
 *   3   — input not found / unreadable
 *   4   — parse error
 *   130 — interrupted
 */
import { parseArgs } from "node:util";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import process from "node:process";
import type { Readable } from "node:stream";

// ---------- types ----------

interface CliArgs {
  readonly input: string;
  readonly delimiter: string;
  readonly hasHeader: boolean;
  readonly json: boolean;
  readonly verbose: boolean;
}

interface ColumnStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly stddev: number;
}

interface AnalysisResult {
  readonly header: readonly string[];
  readonly stats: readonly RunningStats[];
  readonly dataRows: number;
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

class ParseError extends ScriptError {
  readonly kind = "parse" as const;
  readonly exitCode = 4;
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
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

// ---------- arg parsing ----------

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      delimiter: { type: "string", short: "d", default: "," },
      "no-header": { type: "boolean" },
      json: { type: "boolean" },
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
    throw new UsageError(
      "expected exactly one positional argument: <input> (use - for stdin)",
    );
  }

  if (values.delimiter.length !== 1) {
    throw new UsageError("--delimiter must be a single character");
  }

  return {
    input: positionals[0]!,
    delimiter: values.delimiter,
    hasHeader: !values["no-header"],
    json: values.json ?? false,
    verbose: values.verbose ?? false,
  };
}

function printHelp(): void {
  process.stderr.write(
    [
      "usage: csv-analyzer [options] <input>",
      "",
      "  Read a CSV, print summary stats for numeric columns.",
      "  Use - as input to read from stdin.",
      "",
      "options:",
      "  -d, --delimiter <c>   field delimiter (default: ,)",
      "      --no-header       treat first row as data (default: header)",
      "      --json            emit JSON instead of human-readable",
      "  -v, --verbose         enable debug logging",
      "  -h, --help            show this help",
      "",
      "examples:",
      "  csv-analyzer data.csv",
      "  cat data.csv.gz | csv-analyzer -",
      "  csv-analyzer --json --no-header data.tsv -d $'\\t'",
      "",
    ].join("\n"),
  );
}

// ---------- streaming input ----------

async function openInputStream(path: string): Promise<Readable> {
  if (path === "-") return process.stdin;

  const s = await stat(path).catch(() => null);
  if (!s) throw new InputError(`input not found: ${path}`, path);
  if (!s.isFile())
    throw new InputError(`input is not a regular file: ${path}`, path);

  const raw = createReadStream(path);
  if (path.endsWith(".gz")) {
    log.debug("input is gzipped");
    return raw.pipe(createGunzip());
  }
  return raw;
}

// ---------- CSV parsing (RFC-4180 lite) ----------

function parseLine(line: string, delim: string): readonly string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  out.push(buf);
  return out;
}

// ---------- streaming statistics (Welford) ----------

class RunningStats {
  n = 0;
  mean = 0;
  M2 = 0;
  min = Infinity;
  max = -Infinity;

  push(x: number): void {
    this.n++;
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    this.M2 += delta * (x - this.mean);
  }

  get variance(): number {
    return this.n > 1 ? this.M2 / (this.n - 1) : 0;
  }

  get stddev(): number {
    return Math.sqrt(this.variance);
  }

  toColumnStats(): ColumnStats {
    return {
      count: this.n,
      min: this.min,
      max: this.max,
      mean: this.mean,
      stddev: this.stddev,
    };
  }
}

// ---------- main work ----------

async function analyze(args: CliArgs): Promise<AnalysisResult> {
  const stream = await openInputStream(args.input);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let header: readonly string[] | null = null;
  let stats: RunningStats[] | null = null;
  let rowNum = 0;
  let dataRows = 0;

  for await (const line of rl) {
    rowNum++;
    if (line.trim() === "") continue;

    const fields = parseLine(line, args.delimiter);

    if (rowNum === 1 && args.hasHeader) {
      header = fields;
      stats = fields.map(() => new RunningStats());
      log.info(`columns: ${fields.join(", ")}`);
      continue;
    }

    if (stats === null) {
      header = fields.map((_, i) => `col${i + 1}`);
      stats = fields.map(() => new RunningStats());
    }

    if (fields.length !== stats.length) {
      throw new ParseError(
        `row ${rowNum}: expected ${stats.length} fields, got ${fields.length}`,
        rowNum,
      );
    }

    for (let i = 0; i < fields.length; i++) {
      const v = Number(fields[i]);
      if (Number.isFinite(v)) stats[i]!.push(v);
    }
    dataRows++;
  }

  return {
    header: header ?? [],
    stats: stats ?? [],
    dataRows,
  };
}

// ---------- output ----------

function emitHuman(result: AnalysisResult): void {
  process.stderr.write(`\n${result.dataRows} data rows\n\n`);
  process.stdout.write(
    ["column", "count", "min", "max", "mean", "stddev"].join("\t") + "\n",
  );
  for (let i = 0; i < result.header.length; i++) {
    const s = result.stats[i]!;
    if (s.n === 0) continue;
    process.stdout.write(
      [
        result.header[i],
        s.n,
        s.min.toFixed(4),
        s.max.toFixed(4),
        s.mean.toFixed(4),
        s.stddev.toFixed(4),
      ].join("\t") + "\n",
    );
  }
}

function emitJson(result: AnalysisResult): void {
  const out: { rows: number; columns: Record<string, ColumnStats> } = {
    rows: result.dataRows,
    columns: {},
  };
  for (let i = 0; i < result.header.length; i++) {
    const s = result.stats[i]!;
    if (s.n === 0) continue;
    out.columns[result.header[i]!] = s.toColumnStats();
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

// ---------- main ----------

async function main(): Promise<number> {
  const args = parseCliArgs();
  verbose = args.verbose;

  process.on("SIGINT", () => process.exit(130));
  if (process.platform !== "win32") {
    process.on("SIGTERM", () => process.exit(143));
  }

  log.debug("args:", args);
  const result = await analyze(args);

  if (args.json) emitJson(result);
  else emitHuman(result);

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
