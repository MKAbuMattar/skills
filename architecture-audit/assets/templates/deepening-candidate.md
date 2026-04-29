# Deepening candidate template

Use this format for each candidate in the numbered list (step 4 of the workflow). One block per candidate. Keep it tight — the user is comparing N of these, not reading a design doc.

```markdown
### Candidate <N>: <short name using domain vocabulary>

**Files / modules**
- `path/to/file_one.ext`
- `path/to/dir/`
- `path/to/another.ext`

**Problem**
<2-4 sentences. What friction is the current architecture causing? Use vocabulary from `language.md` — shallow, leak across non-seam, scattered concept, testability theater, etc. — and from the project's domain glossary.>

**Deletion test**
<1-2 sentences. What happens if you delete the suspected-shallow module? If complexity reappears at N call sites, name N. If complexity vanishes, the candidate is sound.>

**Solution sketch**
<3-5 sentences in plain English. What would change. Do NOT propose a specific interface yet — that's step 6. Describe the *shape* (one deep module owning X, seam moves from A to B, etc.).>

**Dependency category**
<One of: in-process / local-substitutable / remote-but-owned / true-external. From `deepening.md`. Determines test strategy.>

**Benefits**

- *Locality*: <where change/bugs/knowledge concentrate after the refactor>
- *Leverage*: <what callers gain from a smaller interface>
- *Tests*: <how the test surface improves; old tests to delete; new tests to add>

**Risks / open questions**
<1-3 bullets. What's uncertain about this refactor? What might block it?>

**ADR conflict** (omit if none)
<Only fill in if a candidate contradicts an existing ADR. Format: "Contradicts ADR-NNNN (<title>). Worth reopening because: <load-bearing reason>." Skip if friction isn't real.>
```

---

## Example (filled in)

```markdown
### Candidate 1: Order intake module

**Files / modules**
- `src/handlers/orders.ts`
- `src/validators/orders.ts`
- `src/services/orderService.ts`
- `src/repositories/orderRepository.ts`
- `src/mappers/orderMapper.ts`

**Problem**
The Order concept is scattered across 5 thin modules — handler, validator, service, repository, mapper. Each is shallow: the validator just checks two fields and delegates; the service has one method that calls the repository; the mapper converts between two near-identical shapes. Bugs in the order intake flow consistently land in the wrong file (e.g., the validator is fine but the orchestration in the handler skips a required step), but the unit tests on the validator pass.

**Deletion test**
If we delete the validator and mapper, complexity vanishes — they're pass-throughs. If we delete the service, complexity reappears across 4 callers (the HTTP handler, the queue consumer, the admin tool, the migration script), so the orchestration is real. The right shape is one Order intake module owning the orchestration, validation, and mapping.

**Solution sketch**
Consolidate the five files into one Order intake module. The deepened module owns the full intake flow: validate inputs, normalize the shape, persist via the repository, emit the event. The current handler / queue consumer / admin tool / migration each call one method on the deepened module. The repository stays separate (it's a real seam — see dependency category).

**Dependency category**
Local-substitutable (relational DB via the project ORM, with an embedded SQL test fixture).

**Benefits**

- *Locality*: a change to the intake flow lands in one file. Today it lands in three.
- *Leverage*: callers see one method (`intake(order)`) instead of orchestrating four collaborators.
- *Tests*: delete the unit tests on the validator and mapper. Replace with intake-flow tests that drive the deepened interface against the embedded SQL fixture. The bugs that hide in orchestration today become visible.

**Risks / open questions**
- The admin tool currently does a partial intake (skip persist). Need to decide if the deepened interface supports that or if the admin tool moves to a separate flow.
- The queue consumer has its own retry logic that wraps the current service. Where does that live in the new shape?

**ADR conflict**
Contradicts ADR-0014 (chose to keep validators separate from handlers for "single-responsibility"). Worth reopening because: the SRP framing optimized for class-level responsibility, but the actual responsibility (intaking an order) is the deepened module's. The original justification was deployment-risk concerns that no longer apply since the migration to monorepo deploys.
```

---

## Notes on filling in the template

- **Keep "Problem" honest.** "We could improve testability" is not a problem — it's a wish. "Bugs land in three files because the orchestration is hidden in the handler" is a problem.
- **The deletion test must produce a number.** "Complexity reappears" without naming the call sites is hand-waving. Count them.
- **Do not skip "Dependency category".** It determines test strategy and shapes downstream interface design.
- **Risks are not optional.** Every refactor has risks. If you can't name any, you haven't thought about it hard enough.
- **"Tests" should mention what to delete, not just what to add.** Replace, don't layer.
