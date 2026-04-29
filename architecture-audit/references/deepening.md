# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in `language.md` — Module, Interface, Seam, Adapter, Leverage, Locality.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

**Tests:** call the deepened module; assert at the interface.

### 2. Local-substitutable

Dependencies that have local test stand-ins running in the test process: in-memory database fakes (e.g., embedded SQL engines), in-memory filesystems, fake clocks, in-memory message queues. Deepenable if the stand-in exists or can be built. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

**Tests:** spin up the local stand-in in the test fixture; call the deepened module; assert at the interface.

**When to introduce a local stand-in if one doesn't exist:** when the dependency is deterministic, small to fake, and called by enough tests to amortize the work. When the dependency is large or stateful (e.g., a full search engine), prefer category 3 instead — own less.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network or process boundary (microservices, internal APIs, sibling jobs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**.

**Tests:** in-memory adapter that the test process drives directly. No network, no other process.

**Production:** HTTP / gRPC / queue / RPC adapter that satisfies the same port.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external (Mock)

Third-party services you don't control — payments providers, SMS gateways, external identity, third-party search, analytics SaaS. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

**Tests:** mock adapter that records calls and returns scripted responses. Combined with contract tests against a sandbox of the real provider when one is available.

**Production:** real adapter calling the third-party API.

The temptation to skip the port and call the third-party SDK directly is the path that turns the module shallow — every caller now knows about the SDK. Resist.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them — that's an interface leak.
- **The seam goes where the variation is.** If only one thing varies (e.g., production vs test), the seam goes around the thing that varies. Don't lift the seam higher and force everything above it through a port.
- **Cross-team seams demand contracts.** When the seam is between teams, write a contract test. Mock-only testing on a cross-team seam means the two sides are guaranteed to drift.

## Testing strategy: replace, don't layer

When you deepen a cluster of shallow modules, the old unit tests on the shallow modules become waste. Delete them.

- Old unit tests on shallow modules → delete once tests at the deepened interface exist.
- Write new tests at the deepened module's interface. **The interface is the test surface.**
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes (without the behaviour changing), it's testing past the interface.

### Why "replace, don't layer" is non-negotiable

If you keep the old tests and add new ones, every internal refactor breaks both. The old tests were tightly coupled to the old shallow shapes; they will stay tightly coupled after the refactor unless you delete them. Layering produces:

- 2x test maintenance.
- Duplicate failure surfaces (when one fails, you don't know which is real).
- A test suite that punishes the deepening rather than rewarding it.

The right answer is to delete the old tests in the same change-set that introduces the deepened module's interface tests.

### Migration order

For a non-trivial deepening:

1. Write the new interface and a stub implementation that delegates to the existing shallow modules (so nothing breaks).
2. Write tests at the new interface. Verify they pass against the stub.
3. Migrate one caller at a time to the new interface.
4. Once all callers use the new interface, replace the stub with the deep implementation.
5. Verify the interface tests still pass.
6. Delete the old shallow modules and their tests.

Each step is reviewable / revertable on its own.

## Anti-patterns

- **Deepening without removing.** Adding a new "deeper" module while leaving all the shallow ones in place. Now you have both, and the shallow ones still get used. Always remove the shallow modules in the same change.
- **Keeping the old tests "for safety".** They don't add safety; they add noise. The new interface tests are the contract.
- **Deepening across a wrong seam.** If the variation is between two SQL engines, the seam goes there. If the variation is between "test" and "production", the seam goes there. Don't put the seam between "your business logic" and "everything else" if the variation is finer-grained than that.
- **Premature ports.** Adding a port now "in case we need to swap" is the one-adapter trap. Don't add the port until the second adapter is real.
