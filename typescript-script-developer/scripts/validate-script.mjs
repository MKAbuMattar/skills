#!/usr/bin/env node
/**
 * Score a TypeScript script against the typescript-script-developer checklist.
 *
 * Usage: node validate-script.mjs <script.ts>
 *
 * Checks (each pass = 1 point, total / 16 → percent):
 *   1.  Shebang line `#!/usr/bin/env node`
 *   2.  Top-of-file TSDoc / comment block
 *   3.  Uses `import type` for at least one type import (or has only runtime imports)
 *   4.  Uses `node:` import prefix
 *   5.  Has explicit return type on `main` (`Promise<number>` or `Promise<void>`)
 *   6.  Has at least one `interface` or `type` declaration
 *   7.  Has an Error subclass (or extends ScriptError) with `exitCode`
 *   8.  No `any` keyword in non-test code
 *   9.  No `as any` casts
 *  10.  Uses `unknown` in catch blocks (TS 4.4+ default)
 *  11.  Uses `parseArgs` from `node:util` (or commander/yargs/etc.)
 *  12.  Logs to stderr (uses `process.stderr.write` or `console.error`)
 *  13.  No `console.log` for diagnostics
 *  14.  No sync fs API (`readFileSync`, etc.)
 *  15.  Has main async function and entry-guard with import.meta.url
 *  16.  Handles SIGINT
 */
import { readFile } from "node:fs/promises";
import { exit, argv } from "node:process";
import { extname } from "node:path";

if (argv.length !== 3) {
  process.stderr.write("usage: node validate-script.mjs <script.ts>\n");
  exit(2);
}

const path = argv[2];
const ext = extname(path);
if (ext !== ".ts" && ext !== ".tsx" && ext !== ".mts") {
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
    name: "TSDoc top-of-file block",
    pass: /^(?:#!.*\n)?\s*\/\*\*[\s\S]+?\*\//.test(src),
    fix: "add a TSDoc /** ... */ block at the top describing usage and exit codes",
  },
  {
    name: "uses import type or only runtime imports",
    pass:
      /import\s+type\s/.test(src) ||
      !/import\s+\{[^}]*(?:Stream|Buffer|Type|Schema|Readable)\b/.test(src),
    fix: "use `import type { ... }` for type-only imports (enforced by verbatimModuleSyntax)",
  },
  {
    name: "node: import prefix",
    pass: /from\s+["']node:/.test(src),
    fix: "use `node:` prefix for stdlib imports (e.g., `import { readFile } from 'node:fs/promises'`)",
  },
  {
    name: "main has explicit return type",
    pass: /async\s+function\s+main\s*\([^)]*\)\s*:\s*Promise<(number|void)>/.test(
      src,
    ),
    fix: "annotate `async function main(): Promise<number>` (or void) explicitly",
  },
  {
    name: "interface or type declaration",
    pass: /^\s*(?:interface|type)\s+\w+/m.test(src),
    fix: "declare at least one `interface` or `type` for argv / config / errors",
  },
  {
    name: "Error subclass with exitCode",
    pass: /class\s+\w+\s+extends\s+(?:Error|ScriptError)[\s\S]+?exitCode/.test(
      src,
    ),
    fix: "define an Error subclass with an `exitCode` field for distinct failure modes",
  },
  {
    name: "no `any` keyword",
    pass: !/(?:^|[^a-zA-Z_])any(?:[^a-zA-Z_]|$)/.test(
      src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""),
    ),
    fix: "replace `any` with `unknown` + narrowing, a type guard, or a zod schema",
  },
  {
    name: "no `as any` casts",
    pass: !/\bas\s+any\b/.test(src),
    fix: "remove `as any` casts; use proper narrowing or `as unknown` + validation",
  },
  {
    name: "catch uses unknown",
    pass:
      !/catch\s*\(\s*\w+\s*:\s*(?:Error|object)\s*\)/.test(src) ||
      /catch\s*\(\s*\w+\s*:\s*unknown\s*\)/.test(src) ||
      !/catch\s*\(\s*\w+\s*:/.test(src), // untyped catch is also fine (TS infers unknown)
    fix: "type catch parameters as `unknown` (TS 4.4+ default)",
  },
  {
    name: "explicit arg parsing",
    pass:
      /parseArgs/.test(src) ||
      /from\s+["'](commander|yargs|meow|sade|@oclif)/.test(src),
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
    name: "main + entry-guard with import.meta.url",
    pass:
      /async\s+function\s+main\s*\(/.test(src) &&
      /import\.meta\.url/.test(src) &&
      /fileURLToPath/.test(src),
    fix: "define `async function main()` and guard with `process.argv[1] === fileURLToPath(import.meta.url)`",
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
process.stdout.write(`TS Script Validation: ${path}\n`);
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
