#!/usr/bin/env node
/**
 * Batch file processor.
 *
 * Walks a directory, processes each matching file with bounded concurrency,
 * writes results, reports progress.
 *
 * usage: <script-name> [options] <input-dir>
 */
import { parseArgs } from "node:util";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname, extname, relative } from "node:path";
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

// ---------- arg parsing ----------

function parseCliArgs() {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string", short: "o", default: "./out" },
      pattern: { type: "string", short: "p", default: ".json" },
      concurrency: { type: "string", short: "c", default: "8" },
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    process.stderr.write(
      [
        "usage: <script-name> [options] <input-dir>",
        "",
        "options:",
        "  -o, --output <dir>     output directory (default: ./out)",
        "  -p, --pattern <ext>    file extension to match (default: .json)",
        "  -c, --concurrency <n>  parallel workers (default: 8)",
        "  -v, --verbose          enable debug logging",
        "  -h, --help             show this help",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  if (positionals.length !== 1) {
    throw new UsageError(
      "expected exactly one positional argument: <input-dir>",
    );
  }

  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new UsageError("--concurrency must be a positive integer");
  }

  return {
    inputDir: positionals[0],
    outputDir: values.output,
    pattern: values.pattern,
    concurrency,
    verbose: values.verbose ?? false,
  };
}

// ---------- file walking ----------

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// ---------- bounded-concurrency pool ----------

async function pool(items, limit, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve()
      .then(() => fn(item))
      .catch((err) => ({ error: err, item }));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ---------- per-file work ----------

async function processOne(srcPath, srcRoot, outRoot) {
  const rel = relative(srcRoot, srcPath);
  const outPath = join(outRoot, rel);
  await mkdir(dirname(outPath), { recursive: true });

  const contents = await readFile(srcPath, "utf8");

  // Replace with the actual transformation:
  const transformed = contents;

  // Atomic write
  const tmp = `${outPath}.tmp.${process.pid}`;
  await writeFile(tmp, transformed);
  const { rename } = await import("node:fs/promises");
  await rename(tmp, outPath);

  log.debug(`processed ${rel}`);
  return { rel, bytes: contents.length };
}

// ---------- main ----------

async function main() {
  const args = parseCliArgs();
  verbose = args.verbose;

  const inputStat = await stat(args.inputDir).catch(() => null);
  if (!inputStat?.isDirectory()) {
    throw new UsageError(`input is not a directory: ${args.inputDir}`);
  }

  // Graceful shutdown
  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
    log.info("interrupted, finishing in-flight work");
  });

  // Collect matching files
  const allFiles = [];
  for await (const f of walk(args.inputDir)) {
    if (extname(f) === args.pattern) allFiles.push(f);
  }
  log.info(`found ${allFiles.length} files matching ${args.pattern}`);

  if (allFiles.length === 0) return 0;

  // Process with bounded concurrency
  const startedAt = Date.now();
  let done = 0;
  const results = await pool(allFiles, args.concurrency, async (f) => {
    if (interrupted) return { rel: f, skipped: true };
    const r = await processOne(f, args.inputDir, args.outputDir);
    done++;
    if (done % 50 === 0 || done === allFiles.length) {
      const pct = ((done / allFiles.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      process.stderr.write(
        `\r${done}/${allFiles.length} (${pct}%, ${elapsed}s)`,
      );
    }
    return r;
  });
  process.stderr.write("\n");

  const errors = results.filter((r) => r.error);
  const skipped = results.filter((r) => r.skipped);
  const ok = results.filter((r) => !r.error && !r.skipped);

  log.info(
    `ok: ${ok.length}, errors: ${errors.length}, skipped: ${skipped.length}`,
  );

  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) {
      log.error(`${e.item}: ${e.error.message}`);
    }
    return 1;
  }

  return interrupted ? 130 : 0;
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
