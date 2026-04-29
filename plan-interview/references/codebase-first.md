# Codebase first

Load this when deciding whether to ask a question or read code. The rule: **if the codebase can answer it, read the codebase.** Asking the user things they could grep for in 10 seconds wastes their time and signals you're not paying attention.

## The heuristic

For every candidate question, run this check:

1. **Could a competent engineer find this answer by reading source, configs, or running a small command?**
2. **Is the answer stable** (a fact about the current code) **rather than a decision the user has to make** (a fact about the future)?

If both are yes → read the code. If either is no → ask the user.

## Categories of questions: ask vs. read

### Read the code (don't ask)

- Current behavior of an existing function, route, or module.
- Existing schema (tables, columns, indexes, foreign keys).
- Existing API contract (request/response shape, status codes returned today).
- Which version of a dependency is in use.
- Whether a feature flag exists, where it's defined, what its default is.
- Existing test coverage for a path.
- File or directory structure.
- Whether a config value is already set somewhere.
- The current error format the codebase uses.
- Patterns used elsewhere in the same codebase ("how do we usually do logging here?").
- Whether a TODO / FIXME comment already flagged this.
- Recent commit history that touched the area (`git log -- path`).

### Ask the user (don't try to read)

- What the new behavior should be.
- Which of two valid approaches to take when both are reasonable.
- Business or product priority that's not encoded in code.
- Constraints that aren't in the repo (deadline, team capacity, stakeholder ask, regulatory).
- Risk appetite and rollback tolerance.
- Whether to break a contract or preserve it.
- What "done" means for a soft requirement.
- Anything about other systems / services / teams not in the workspace.
- The user's preference when the trade-off is genuinely a values call.

### Mixed (read first, then confirm)

Some questions have a code-readable answer that needs human confirmation:

- "The current error format is `{error: string}` — do we keep that or switch to `{error: {code, message}}` for the new endpoints?" (Read first; ask the choice.)
- "The retry policy in the existing webhook handler is exponential backoff with 5 attempts — should the new handler match?" (Read first; ask the choice.)

## How to read the code efficiently

You don't need to read everything. Use the smallest tool that answers the question:

| Question shape                             | Tool                                          |
| ------------------------------------------ | --------------------------------------------- |
| "Does function `X` exist?"                 | grep / file search                            |
| "What does function `X` return today?"     | read the file containing X                    |
| "What's the schema of the `users` table?"  | search for the migration / model file         |
| "Which version of library `X` are we on?"  | read `package.json` / `requirements.txt` etc. |
| "When was the last change to file `X`?"    | `git log -- file`                             |
| "Is feature flag `Y` defined anywhere?"    | grep across configs                           |
| "What's the test coverage for module `Z`?" | read `tests/` or run the test runner          |

Don't read the whole repo. Read the file that answers the question, ship the answer in your next question's premise, move on.

## What to do when the code is ambiguous

Sometimes the code answers the question but the answer raises a follow-up:

- The current error format is inconsistent across modules.
- There are two retry implementations and they differ.
- The schema has nullable columns that look like they shouldn't be.

In those cases:

1. State the ambiguity in the question.
2. Recommend the unification you'd pick.
3. Ask the user to confirm.

> **Q3: The codebase has two error formats — `{error: string}` in the v1 routes, `{error: {code, message}}` in the v2 routes. The new endpoint should match v2.**
>
> **My recommendation:** Match v2. **Why:** The v1 format is being deprecated; matching v2 avoids a third format.

## When the workspace is missing

Sometimes the user's plan references a system you can't see (a separate service, a private SDK, an external API). Don't pretend you can read it.

- If the answer is in the part you can see → read it, present the finding.
- If it's in the part you can't see → ask the user, but cite specifically what you couldn't find ("I couldn't find the service-B contract in this workspace — what does service-B return for the not-found case?").

## Anti-pattern: ask-then-grep

Don't ask the user a question, then go read the code anyway after they answer. That wastes a turn. Read first.

## Anti-pattern: grep-then-ignore

Don't read the code and then ask the question as if you hadn't. The premise should reflect what you found:

- Bad: "What's the error format?"
- Good: "The codebase currently uses `{error: string}` in v1 and `{error: {code, message}}` in v2. The new endpoint — match v2?"

The premise carries the code-reading work; the question is just the unresolved choice.
