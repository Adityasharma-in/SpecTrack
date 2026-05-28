# Extended Red-Teaming Checklist

Read this file during Stage 3 for security-critical, high-availability, or financial systems. These scenarios extend the default table in SKILL.md.

---

## Security Scenarios

| Attack Vector | What to check |
|---|---|
| SQL / NoSQL Injection | Are all queries parameterized? Is ORM used at every data boundary? |
| Mass Assignment | Does the API accept a raw dict/body and pass it to the ORM? Name every field explicitly. |
| IDOR (Insecure Direct Object Reference) | Does every resource lookup verify the requesting user owns that resource? |
| JWT / Session Forgery | Are tokens validated server-side on every request? Is the signing secret rotated? |
| SSRF (Server-Side Request Forgery) | If users can supply URLs, are destinations validated against an allowlist? |
| Secrets in Logs | Does any log line risk printing tokens, passwords, or PII? |
| Dependency Vulnerabilities | Are you pinning exact versions? Is there a process for CVE scanning? |

---

## Availability & Reliability Scenarios

| Scenario | What to check |
|---|---|
| Thundering Herd | If cache expires for a hot key, do N requests hit the DB simultaneously? Add probabilistic early expiry or a mutex. |
| Retry Storm | If retries are unbounded with no jitter, a degraded service gets hammered. Enforce exponential backoff with jitter. |
| Memory Leak | Are event listeners / subscriptions / DB connections being cleaned up on teardown? |
| Graceful Shutdown | Does the process drain in-flight requests before SIGTERM? What happens to queued work? |
| Partial Write Failure | If a write to DB succeeds but a write to the search index fails, is the system in an inconsistent state? Use a saga or two-phase approach. |
| Clock Skew | Are distributed nodes relying on wall-clock time for ordering? Use logical clocks or vector clocks for ordering guarantees. |

---

## Data Integrity Scenarios

| Scenario | What to check |
|---|---|
| Double-spend / Double-submit | Can a user trigger the same mutation twice before the first completes? Idempotency key required. |
| Orphaned Records | If a parent record is deleted, what happens to children? Cascade rules must be explicit. |
| Schema Migration Safety | Is the migration backward-compatible? Can the old code run against the new schema during a rolling deploy? |
| Floating Point Money | Never use floats for currency. Use integers (cents) or a decimal type. |
| Timezone Ambiguity | Are all timestamps stored as UTC? Is timezone conversion happening at the correct layer (display only)? |

---

## Operational Scenarios

| Scenario | What to check |
|---|---|
| Log Volume | At 100x traffic, does log verbosity cause I/O contention or storage explosion? Sample debug logs in production. |
| Alert Fatigue | Are alerts on SLOs (error rate, latency p99) or on individual exceptions? Exception-level alerts cause noise. |
| Feature Flag Rollback | If a bad deploy goes out, can this feature be disabled without a redeploy? |
| Runbook Gap | Is there a clear runbook for the most likely failure mode? If not, write it before shipping. |
| Cold Start | If this is serverless or auto-scaled, what is the cold-start latency and is it acceptable? |

---

## The "One More" Rule

After completing Stage 3, ask one final question:

> "If this code silently produced wrong output for 1% of users for 30 days before anyone noticed, what would that scenario look like?"

Document the answer and add a mitigation or monitoring hook for it.