name: ULTRATHINK
description: >
  Forces deep, structured architectural reasoning before writing any code or solution.
  Activates a multi-stage cognitive protocol: environment analysis, architectural
  blueprinting, adversarial red-teaming, and execution planning — before producing
  output. Use this skill whenever the user asks for production-grade code, system
  architecture, complex data pipelines, API design, database schemas, infrastructure
  decisions, or any engineering task where correctness and scalability matter.
  Also trigger when the user says "think deeply", "ultrathink", "think like a senior
  engineer", "architect this", or "don't rush — think first". If the task is
  non-trivial and getting it wrong would be costly, use this skill.
---

# ULTRATHINK — Agentic Cognitive Architecture Skill

## Purpose

This skill enforces a **mandatory reasoning protocol** before producing any implementation. It structurally prevents premature code generation by requiring Claude to move through four cognitive stages — written inside a visible scratchpad — before touching a single line of production code.

This is not optional decoration. The scratchpad is the work.

---

## When to Activate

Trigger this skill for any task that is:

- Producing production code (APIs, pipelines, services, infra)
- Designing a system, schema, or architecture
- Debugging a non-obvious failure in a complex system
- Writing anything that will run in a real environment with real users or data
- Explicitly requested with "ultrathink", "think deeply", "architect this"

Do **not** use for simple one-liners, purely conversational responses, or trivial edits.

---

## The Protocol

### STEP 1 — Open the Scratchpad

Before writing any code, open a `<cognitive_scratchpad>` block and work through all four stages below. Do not close it until all four are complete.

```
<cognitive_scratchpad>
```

---

### STAGE 1 · Environment & Constraint Ingestion

Answer these explicitly:

- **Runtime reality:** What environment is this running in? Cloud? Serverless? On-prem? What are the actual constraints — memory limits, concurrency, cold starts, build pipeline quirks?
- **Data assumptions:** Treat all inputs as adversarial. Assume strings are malformed, numbers contain nulls or garbage values, distributions are skewed. Where must you sanitize, coerce, or validate?
- **Dependency audit:** List every external library, API, or service this will touch. For each one, ask: "Am I certain this method/endpoint exists in the version the user likely has?" If there is any doubt, fall back to primitives or version-locked, well-established packages.
- **Integration surface:** What existing systems does this touch? What must remain unchanged?

---

### STAGE 2 · Architectural Blueprint

Design before building:

- **Data flow map:** Trace the exact path of data — from ingestion source → transformation layer → persistence → output/rendering. Name each stage.
- **State & side effects:** What global state does this modify? What side effects exist (writes, emails, charges, notifications)? Are they idempotent?
- **Performance model:** Estimate the computational complexity. At what scale does this break? Mandate vectorized operations, CTEs, or indexed lookups where O(n²) patterns would emerge.
- **Interface physics** (for UI tasks): Define exact layout geometry, spacing units, rendering logic. Do not approximate visual behavior — specify it.
- **Modularity plan:** Define the file structure, module boundaries, and function signatures now. Name them.

---

### STAGE 3 · Adversarial Red-Teaming

You must actively attempt to destroy your own Stage 2 blueprint. This stage is not optional.

Run these failure simulations and document results:

| Scenario | What breaks? | Mitigation |
|---|---|---|
| Data scales 100x | ... | ... |
| Primary DB drops mid-write | ... | ... |
| External API times out or returns 500 | ... | ... |
| Malformed/null input at every boundary | ... | ... |
| Concurrent users trigger race condition | ... | ... |
| Dependency version mismatch | ... | ... |

**Requirement:** Identify at least **one critical flaw** in your Stage 2 blueprint and revise it here before proceeding. If you find no flaw, you are not looking hard enough — look again.

---

### STAGE 4 · Execution Protocol

Lock in the plan:

- Final directory structure and file names
- Exact function signatures with types
- Error handling strategy (which errors are caught, which propagate, which alert)
- Testing approach: what is the minimum set of assertions that would prove this works in production?
- Any decisions deferred to the user before implementation begins

---

```
</cognitive_scratchpad>
```

Close the scratchpad. Only now may you write code.

---

## STEP 2 — Implementation Directives

Once the scratchpad is closed, produce the solution under these absolute rules:

### Rule 1 — Zero Placeholders
No `TODO`, no `# logic goes here`, no pseudo-code, no `...`. Every function body is complete and production-ready. If something is genuinely unknown, ask the user before writing anything — do not paper over it with a comment.

### Rule 2 — Strict Typing Everywhere
All function signatures include type hints. All data structures use immutable types where mutation isn't required. All external data is validated at the boundary before entering the system.

### Rule 3 — Graceful Failure at Every Edge
Every I/O operation has error handling. Every external call has a timeout and a fallback path. Failure modes are logged with enough context to debug without a debugger.

### Rule 4 — Silent Integration
Do not rewrite working code unless explicitly instructed. Integrate with the existing paradigm. Match the style and conventions of the surrounding codebase.

### Rule 5 — Architectural Proof
End every implementation with a 2-sentence summary of:
- The exact design pattern used
- Why that pattern mathematically or structurally guarantees correctness or optimal performance at scale

---

## Output Format

```
<cognitive_scratchpad>
[Four stages — fully worked]
</cognitive_scratchpad>

---

[Production-ready implementation]

---

**Architectural Proof:** [2 sentences]
```

---

## Calibration Notes

- The scratchpad should be **genuinely substantive**, not a performance of thinking. If Stage 3 produces no real flaws, the red-teaming was shallow. Push harder.
- For very simple tasks that technically qualify but are clearly low-stakes, compress the scratchpad — but never skip it entirely. A 5-line scratchpad is fine for a 10-line utility function. A 50-line scratchpad is required for a multi-service architecture.
- If the user asks "why did you write so much before the code?" — explain that the scratchpad is the engineering work, not overhead. The code is the artifact; the reasoning is the foundation.

---

## Reference Files

- `references/patterns.md` — Common architectural patterns and when to select them (read when Stage 4 requires pattern selection for complex systems)
- `references/redteam-checklist.md` — Extended adversarial scenarios beyond the default Stage 3 table (read for security-critical or high-availability systems)