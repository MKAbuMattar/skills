# Language

Shared vocabulary for every audit this skill produces. Use these terms exactly — don't substitute "component", "service", "API", or "boundary". Consistent vocabulary is what makes audits comparable across modules, sessions, and team members.

## Core terms

### Module

Anything with an interface and an implementation. Deliberately scale-agnostic — applies equally to a function, class, package, file, namespace, or a tier-spanning slice that crosses processes.

*Avoid*: unit, component, service. They mean different things to different readers; the term you actually need is "module" (or, when you mean specifically the type/lifetime side, "adapter").

### Interface

Everything a caller must know to use the module correctly. Includes the type signature, but also:

- **Invariants** — what must be true before / after each call.
- **Ordering constraints** — must `init` come before `connect`? Can `flush` happen mid-batch?
- **Error modes** — what does the module throw / return / signal? Under what conditions?
- **Required configuration** — env vars, init params, runtime registrations.
- **Performance characteristics** — is it O(1) per call? Does it cache? Does it block?

*Avoid*: API, signature. Both are too narrow — they refer only to the type-level surface, but the interface is the *whole* contract.

### Implementation

What's inside a module — the body of code that fulfills the interface. Distinct from **Adapter**:

- A thing can be a small adapter with a large implementation (a relational-DB repo).
- A thing can be a large adapter with a small implementation (an in-memory fake of the same repo).

Reach for "adapter" when the seam is the topic; "implementation" when the body of code is the topic.

### Depth

Leverage at the interface — the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn.

- A module is **deep** when a large amount of behaviour sits behind a small interface.
- A module is **shallow** when the interface is nearly as complex as the implementation.

Depth is a property of the *relationship* between interface and implementation, not of either alone.

### Seam

A place where you can alter behaviour without editing in that place. The *location* at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it. (Term borrowed from the legacy-code refactoring tradition.)

*Avoid*: boundary. It's overloaded with DDD's "bounded context" and confuses domain-modeling discussions with architecture discussions. Say **seam** or **interface**.

### Adapter

A concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside). The same adapter role can be filled by:

- A production adapter (real network, real DB).
- A test adapter (in-memory, deterministic, fast).
- A fake / contract adapter (simulates the production one for cross-team contracts).

### Leverage

What callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.

### Locality

What maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.

## Core principles

### The deletion test

Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything (it was a pass-through). If complexity reappears across N callers, the module was earning its keep.

This is the load-bearing test for "is this shallow?" — without it, "shallow" is just a feeling.

### The interface is the test surface

Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape — either the test should move to a different seam, or the module should be reshaped so the thing you want to verify is observable at the interface.

Corollary: tests that survive internal refactors are tests that asserted at the interface. Tests that break on internal refactors were testing past the interface.

### One adapter means a hypothetical seam. Two adapters means a real one.

Don't introduce a seam unless something actually varies across it. Production + test = two adapters, justifies the seam. Production alone = no seam, just indirection.

A useful sanity check: if you can't name two adapters that exist *today* (or will exist within the next month), you don't have a seam, you have aspiration.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

A deep module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface. Internal seams are an implementation detail and should not appear in the interface — even when tests use them.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines**: rewards padding the implementation. Use depth-as-leverage instead — how much behaviour can a caller exercise per unit of interface they had to learn?
- **"Interface" as the language-level `interface` keyword or a class's public methods**: too narrow. Interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.
- **"Component" / "service"**: too vague. Both routinely mean "the thing on the other side of an HTTP call" *and* "a function in the same file". Say **module** and let the scale come from the surrounding context.
