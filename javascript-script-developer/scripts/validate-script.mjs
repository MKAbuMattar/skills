#!/usr/bin/env node
/**
 * Score a Node.js script against the javascript-script-developer checklist.
 *
 * Usage: node validate-script.mjs <script.js|script.mjs>
 *
 * Checks (each pass = 1 point, total / 14 → percent):
 *   1.  Shebang line `#!/usr/bin/env node`
 *   2.  Top-of-file JSDoc / comment block
 *   3.  ESM (uses `import` not `require`)
 *   4.  Uses `node:` import prefix
 *   5.  Uses `parseArgs` from `node:util` (or has explicit arg parsing)
 *   6.  Logs to stderr (uses `process.stderr.write` or `console.error`)
 *   7.  Does not use `console.log` for diagnostics
 *   8.  Does not use sync fs API (`readFileSync`, `writeFileSync`, etc.)
 *   9.  Does not use `require()` (true ESM)
 *  10.  Defines at least one Error subclass with `exitCode`
 *  11.  Has a top-level `main` async function
 *  12.  Has the entry-guard (`isEntry` pattern with `import.meta.url`)
 *  13.  Calls `process.exit` with an explicit code
 *  14.  Handles SIGINT
 */
import { readFile } from "node:fs/promises";
import { exit, argv } from "node:process";
import { extname } from "node:path";

if (argv.length !== 3) {
  process.stderr.write(
    "usage: node validate-script.mjs <script.js|script.mjs>\n",
  );
  exit(2);
}

const path = argv[2];
const ext = extname(path);
if (ext !== ".js" && ext !== ".mjs" && ext !== ".cjs") {
  process.stderr.write(
    `warning: unexpected extension ${ext}; checking anyway\n`,
  );
}

const src = await readFile(path, "utf8").catch((err) => {
  process.stderr.write(`error: cannot read ${path}: ${err.message}\n`);
  exit(2);
});

const checks = [
  {
    name: "shebang",
    pass: /^#!\/usr\/bin\/env node/.test(src),
    fix: "add `#!/usr/bin/env node` as the first line",
  },
  {
    name: "top-of-file JSDoc/comment",
    pass: /^(?:#!.*\n)?\s*\/\*\*?[\s\S]+?\*\//.test(src),
    fix: "add a JSDoc-style /** ... */ block at the top describing usage and exit codes",
  },
  {
    name: "ESM (uses import)",
    pass: /^\s*import\s/m.test(src),
    fix: "use ESM `import` instead of `require()`",
  },
  {
    name: "node: import prefix",
    pass: /from\s+["']node:/.test(src),
    fix: "use `node:` prefix for stdlib imports (e.g., `import { readFile } from 'node:fs/promises'`)",
  },
  {
    name: "explicit arg parsing",
    pass:
      /parseArgs/.test(src) ||
      /from\s+["'](commander|yargs|meow|sade)["']/.test(src),
    fix: "use `parseArgs` from `node:util`, or commander/yargs for complex CLIs",
  },
  {
    name: "logs to stderr",
    pass: /process\.stderr\.write|console\.error/.test(src),
    fix: "log diagnostics to stderr via `process.stderr.write` or `console.error`",
  },
  {
    name: "no console.log for diagnostics",
    pass: !/console\.log\(["'`]\[?(debug|info|warn|error)/i.test(src),
    fix: "use `console.error` (not `console.log`) for log lines",
  },
  {
    name: "no sync fs API",
    pass: !/\b(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync)\b/.test(
      src,
    ),
    fix: "use promise APIs from `node:fs/promises` instead of `*Sync` variants",
  },
  {
    name: "no require()",
    pass: !/(?:^|[^.\w])require\s*\(/.test(src),
    fix: "use ESM `import` instead of CommonJS `require()`",
  },
  {
    name: "Error subclass with exitCode",
    pass: /class\s+\w+\s+extends\s+Error[\s\S]+?exitCode/.test(src),
    fix: "define at least one Error subclass with an `exitCode` field for distinct failure modes",
  },
  {
    name: "main async function",
    pass: /async\s+function\s+main\s*\(/.test(src),
    fix: "define an `async function main()` and put the script's work inside it",
  },
  {
    name: "entry-guard with import.meta.url",
    pass: /import\.meta\.url/.test(src) && /fileURLToPath/.test(src),
    fix: "guard `main()` with `process.argv[1] === fileURLToPath(import.meta.url)` so the file is safe to import",
  },
  {
    name: "explicit process.exit",
    pass: /process\.exit\(/.test(src),
    fix: "exit with an explicit code (`process.exit(0)` on success, non-zero on failure)",
  },
  {
    name: "handles SIGINT",
    pass: /process\.on\s*\(\s*["']SIGINT["']/.test(src),
    fix: "register a SIGINT handler for graceful shutdown",
  },
];

const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const pct = Math.round((passed / total) * 100);

process.stdout.write(`\n${"=".repeat(60)}\n`);
process.stdout.write(`Script Validation: ${path}\n`);
process.stdout.write(`${"=".repeat(60)}\n`);
for (const c of checks) {
  const mark = c.pass ? "✓" : "✗";
  process.stdout.write(
    `${mark} ${c.name.padEnd(40)} ${c.pass ? "" : "→ " + c.fix}\n`,
  );
}
process.stdout.write(`${"=".repeat(60)}\n`);
process.stdout.write(`Score: ${pct}% (${passed} / ${total} checks)\n`);
process.stdout.write(`${"=".repeat(60)}\n`);

exit(pct >= 90 ? 0 : 1);
