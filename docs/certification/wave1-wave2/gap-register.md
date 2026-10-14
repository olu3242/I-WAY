# Gap register

Authoritative batch status is docs/execution/B181-B230-MASTER-PLAN.md. This document expands requirements and evidence limits, not an independent completion register.

| Requirement | Implementation/evidence | Remaining gap |
|---|---|---|
| B187 contention experiment | Original run then five repetitions each at one/four workers, bounded raw phase samples | No fair-scheduling guarantee outside finite workload; host attribution limited |
| B188 contention correction | Seven-statement cache, acquisition-failure classification, rollback preservation; lock timeout, bounded exhaustion, killed writer and concurrent regressions | Cache does not eliminate variable host scheduling/commit cost |
| B189 unchanged repeat performance | Gate A five runs retained, two pass and three fail | Reproducible all-scenario pass required; no approved p99 budget |
| B190 PostgreSQL | Existing forced RLS/restricted actor-bound store plus atomic checksum-tracked fixture migration application; expanded resource and concurrent approval tests | Hosted role/deployment credentials and full async HTTP/domain parity unavailable; local fixture initialization initially timed out |
| B191 lifecycle | Persisted canonical milestone alongside compatible execution status; explicit Ready, evidence-gated Closed | Ready remains optional for old callers; no hosted lifecycle adapter |
| B192 eligibility | Reused existing carrier approval/active driver/compliance/capacity/fleet rules; cancellation and independent human-approved capacity application | Hosted concurrency/operational acceptance unavailable |
| B193 tracking | UTC occurrence/server timestamps, scoped duplicate conflict detection, out-of-order evidence, human provenance | Provider events deliberately remain unapplied; real provider reconciliation contract missing |
| B194 exceptions | Eight categories reuse durable retries, human approval and recovery; pre-dispatch/delivered intake | No external incident automation; recovery of assigned equipment still requires current eligibility |
| B195 documents | Existing revision and immutable POD contracts; hash verification on retrieval/readiness; closure rejects missing evidence | Local SQLite document storage only; hosted object-storage contract not configured |
| B196 notifications | Seven lifecycle events plus legacy templates; explicit local opt-in, authorization, retry/dead letter, template version, local status | Approved live consent/communication policy, provider and external delivery proof unavailable |
| B197 adapters | Existing signed integration/advisory interfaces; preserved hardening and bounded fixture HTTPS contract | No native live transport, approved provider or commercial credentials |
| B198 resilience | Existing callbacks/replay/lease/circuit plus cancellation, policy revocation and strict receipt/response tests | Real service outage/rate-limit behavior not certified |
| B199 tenant journeys | Two concurrent full HTTP journeys, same SQLite database, scope denial for eight object kinds and audit; PG resource matrix | Hosted API and PostgreSQL full business journey unavailable |
| B200 hosted journey | Local journey exercises onboarding through closure/audit | Hosted certification BLOCKED; local evidence cannot satisfy hosted acceptance |
