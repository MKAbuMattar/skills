#!/usr/bin/env node
/**
 * csv-analyzer — read a CSV, summarize numeric columns.
 *
 * Reads a CSV file (or stdin), parses each row, and prints summary statistics
 * (count, min, max, mean, stddev) for each numeric column. Skips non-numeric
 * columns. Supports gzip-compressed input.
 *
 * usage: csv-analyzer [options] <input>
 *
 * exit codes:
 *   0  success
 *   1  generic error
 *   2  bad arguments
 *   3  input not found / unreadable
 *   4  parse error
 *   130 interrupted
 */
import { parseArgs } from "node:util";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import process from "node:process";

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
  constructor(msg) {
    super(msg);
    this.name = "InputError";
    this.exitCode = 3;
  }
}
class ParseError extends Error {
  constructor(msg, { line } = {}) {
    super(msg);
    this.name = "ParseError";
    this.line = line;
    this.exitCode = 4;
  }
}

// ---------- arg parsing ----------

function parseCliArgs() {
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
    input: positionals[0],
    delimiter: values.delimiter,
    hasHeader: !values["no-header"],
    json: values.json ?? false,
    verbose: values.verbose ?? false,
  };
}

function printHelp() {
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

async function openInputStream(path) {
  if (path === "-") {
    return process.stdin;
  }

  const s = await stat(path).catch(() => null);
  if (!s) throw new InputError(`input not found: ${path}`);
  if (!s.isFile()) throw new InputError(`input is not a regular file: ${path}`);

  const raw = createReadStream(path);
  if (path.endsWith(".gz")) {
    log.debug("input is gzipped");
    return raw.pipe(createGunzip());
  }
  return raw;
}

// ---------- CSV parsing (RFC-4180 lite) ----------

function parseLine(line, delim) {
  const out = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
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
  constructor() {
    this.n = 0;
    this.mean = 0;
    this.M2 = 0;
    this.min = Infinity;
    this.max = -Infinity;
  }
  push(x) {
    this.n++;
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    this.M2 += delta * (x - this.mean);
  }
  get variance() {
    return this.n > 1 ? this.M2 / (this.n - 1) : 0;
  }
  get stddev() {
    return Math.sqrt(this.variance);
  }
}

// ---------- main work ----------

async function analyze({ input, delimiter, hasHeader }) {
  const stream = await openInputStream(input);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let header = null;
  let stats = null;
  let rowNum = 0;
  let dataRows = 0;

  for await (const line of rl) {
    rowNum++;
    if (line.trim() === "") continue;

    const fields = parseLine(line, delimiter);

    if (rowNum === 1 && hasHeader) {
      header = fields;
      stats = fields.map(() => new RunningStats());
      log.info(`columns: ${fields.join(", ")}`);
      continue;
    }

    if (!stats) {
      header = fields.map((_, i) => `col${i + 1}`);
      stats = fields.map(() => new RunningStats());
    }

    if (fields.length !== stats.length) {
      throw new ParseError(
        `row ${rowNum}: expected ${stats.length} fields, got ${fields.length}`,
        { line: rowNum },
      );
    }

    for (let i = 0; i < fields.length; i++) {
      const v = Number(fields[i]);
      if (Number.isFinite(v)) stats[i].push(v);
    }
    dataRows++;
  }

  return { header, stats, dataRows };
}

// ---------- output ----------

function emitHuman({ header, stats, dataRows }) {
  process.stderr.write(`\n${dataRows} data rows\n\n`);
  const cols = ["column", "count", "min", "max", "mean", "stddev"];
  process.stdout.write(cols.join("\t") + "\n");
  for (let i = 0; i < header.length; i++) {
    const s = stats[i];
    if (s.n === 0) continue; // skip non-numeric columns
    process.stdout.write(
      [
        header[i],
        s.n,
        s.min.toFixed(4),
        s.max.toFixed(4),
        s.mean.toFixed(4),
        s.stddev.toFixed(4),
      ].join("\t") + "\n",
    );
  }
}

function emitJson({ header, stats, dataRows }) {
  const out = {
    rows: dataRows,
    columns: {},
  };
  for (let i = 0; i < header.length; i++) {
    const s = stats[i];
    if (s.n === 0) continue;
    out.columns[header[i]] = {
      count: s.n,
      min: s.min,
      max: s.max,
      mean: s.mean,
      stddev: s.stddev,
    };
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

// ---------- main ----------

async function main() {
  const args = parseCliArgs();
  verbose = args.verbose;

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

  log.debug(`args: ${JSON.stringify(args)}`);
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
    .catch((err) => {
      if (err.exitCode != null) {
        log.error(err.message);
        process.exit(err.exitCode);
      }
      log.error("unexpected:", err.stack ?? err.message);
      process.exit(1);
    });
}
