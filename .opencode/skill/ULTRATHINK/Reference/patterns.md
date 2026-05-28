# Architectural Patterns Reference

Read this file during Stage 4 when you need to select and justify a design pattern for a complex system.

---

## Table of Contents

1. [Data Pipeline Patterns](#data-pipeline-patterns)
2. [API & Service Patterns](#api--service-patterns)
3. [Concurrency & State Patterns](#concurrency--state-patterns)
4. [Database Patterns](#database-patterns)
5. [UI Architecture Patterns](#ui-architecture-patterns)
6. [Selection Heuristics](#selection-heuristics)

---

## Data Pipeline Patterns

### Extract-Transform-Load (ETL) vs ELT
- **ETL:** Transform before loading. Use when the destination has strict schema constraints or limited compute.
- **ELT:** Load raw, transform in-place. Use when the destination (e.g., BigQuery, Snowflake) has massive compute and you want schema flexibility.
- **When ETL breaks:** At scale, in-memory transformation of large datasets causes OOM. Mitigation: chunked streaming with generators, or push transforms to the engine.

### Streaming vs Batch
- **Batch:** Predictable, simple, tolerates latency. Use for nightly reports, bulk imports.
- **Streaming:** Low-latency, complex, stateful. Use for real-time dashboards, fraud detection, event-driven systems.
- **Hybrid (Lambda Architecture):** Batch layer for historical accuracy + speed layer for recent data. Use when you need both correctness and low latency but can afford the operational complexity.

### Fan-out / Scatter-Gather
Use when a single input triggers parallel computation across N workers, then results are aggregated. Guarantees: if workers are independent, total time ≈ max(worker_time) not sum. Risk: partial failures — ensure all workers report back before aggregating, or implement partial result handling.

---

## API & Service Patterns

### Repository Pattern
Abstracts data access behind an interface. The service layer never touches the ORM or raw SQL directly. Guarantees: swap databases without touching business logic. Required when: multiple data sources, or testability matters.

### CQRS (Command Query Responsibility Segregation)
Separate read and write models. Commands mutate state; queries read from an optimized read model. Use when: read and write workloads have dramatically different performance characteristics. Overkill for: simple CRUD apps.

### Circuit Breaker
Wraps external calls. After N consecutive failures, the circuit "opens" and fast-fails requests for a cooldown period, then allows a probe request. Guarantees: prevents cascading failure when a downstream service is degraded. Required for: any system calling external APIs or microservices.

### Idempotency Keys
Every mutating operation accepts a client-generated idempotency key. Duplicate requests with the same key return the original result without re-executing. Required for: payment processing, email sending, any operation where "exactly once" semantics matter.

---

## Concurrency & State Patterns

### Optimistic Locking
Read → modify → write with a version check at write time. If the version changed between read and write, abort and retry. Use when: contention is low and you want to avoid lock overhead. Fails loudly on high contention — use pessimistic locking there instead.

### Actor Model
Each entity is an actor with its own state and a mailbox. Actors communicate only via messages; no shared mutable state. Guarantees: eliminates entire classes of race conditions. Use for: highly concurrent systems, game servers, real-time collaboration.

### Event Sourcing
Store state as an immutable log of events, not as current values. Current state = replay of all events. Guarantees: full audit trail, temporal queries, trivial undo. Cost: replay time grows with log length — mitigate with snapshots.

---

## Database Patterns

### Connection Pooling
Never create a connection per request. Use a pool (PgBouncer, SQLAlchemy pool, HikariCP). Rule of thumb: pool_size = (cpu_cores × 2) + effective_spindle_count. Exceeding this degrades performance rather than improving it.

### Read Replicas
Route read queries to replicas; write queries to primary. Guarantees: horizontal read scaling. Risk: replication lag — never read your own writes from a replica without a consistency mechanism.

### Materialized Views
Precompute expensive aggregations and store as a table. Refresh on schedule or on trigger. Use when: a query is expensive, runs frequently, and can tolerate slight staleness.

### Soft Deletes
Add `deleted_at` timestamp instead of hard-deleting rows. Every query must include `WHERE deleted_at IS NULL`. Risk: easy to forget the filter — enforce at the ORM/repository layer, not ad-hoc in queries.

---

## UI Architecture Patterns

### Compound Components
Parent component owns state; children communicate via context or render props. Use for: complex interactive widgets (tabs, accordions, dropdowns) where children need coordination without prop drilling.

### Optimistic UI Updates
Update the UI immediately on user action; roll back if the server rejects. Guarantees: sub-100ms perceived latency on mutations. Required for: any action the user expects to be instant (like, follow, add-to-cart).

### Virtual Scrolling
Render only visible rows in a long list. DOM node count stays constant regardless of data size. Required when: list length > ~500 items. Libraries: react-window, TanStack Virtual.

---

## Selection Heuristics

| Situation | Pattern to reach for |
|---|---|
| External API dependency | Circuit Breaker + timeout |
| High-stakes mutations (payments, email) | Idempotency Keys |
| Complex read + write workloads | CQRS |
| Need full audit trail | Event Sourcing |
| Concurrent writes to shared state | Optimistic Locking |
| Large dataset aggregations | Materialized Views |
| Long lists in UI | Virtual Scrolling |
| Testable data access | Repository Pattern |
| Real-time events | Streaming + Fan-out |