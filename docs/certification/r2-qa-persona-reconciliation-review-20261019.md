# R2 QA Persona Branch Review — 2026-10-19

Status: REVIEW ONLY. No authorization changes merged.

## Sources inspected
- feat/iway-qa-persona-security-20261014: domain/qa-persona-policy.mjs
- feat/iway-qa-persona-switch-policy-20261014: domain/qa-persona-switch-policy.mjs and domain/qa-persona-session-service.mjs

## Confirmed differences
| Control | Security branch | Switch-policy branch | Reconciliation action |
| --- | --- | --- | --- |
| Environments | test, development, preview, staging | test, development, preview | Agree QA environment allowlist |
| Admin verification | active, role, switch flag | additionally verified, UUID identity | Prefer verified identity and validated IDs |
| Target restrictions | carrier, fleet, driver | carrier_admin, fleet_admin, driver with qaAccount | Map actual role enum, enforce QA-only targets |
| Duration | <=15 minutes in resolve | <=15 minutes in start and resolve | Enforce at both boundaries |
| Reason | 8-500 characters | not required | Require documented reason and audit |
| Tenant | target tenant binding | grant tenant binding | Enforce real-actor tenant authority and RLS |
| Session service | host adapter responsibility | injectable durable ports | Integrate only with trusted server identity and durable storage |

## Risks requiring tests
1. QA-only target account check is absent in security branch policy.
2. Switch-policy branch does not require a reason at grant issuance.
3. Different role names may create incompatible authorization decisions.
4. Audit persistence and grant storage are external ports; not automatically durable.
5. Avoid relying on a client-provided authenticatedActorId as proof of authentication.
6. Review revocation atomicity and behavior on audit failure.
7. Never permit production activation or cross-tenant privilege escalation.

## Next safe execution
- Inspect main's actual role enum, HTTP auth boundary and RLS.
- Design one canonical QA delegation contract.
- Write red/green tests for every policy invariant before integrating.
- Run full verify, browser and PostgreSQL tests on candidate.
- Require independent security review before merge.

No runtime tests were executed as part of this read-only comparison.
