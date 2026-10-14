# Security and authorization controls

- Deny by default: absent pinned trust, consent, restricted identity, rotation attestation, fixture approval, rollback approval or transport blocks hosted execution.
- Trust is out of band: Ed25519 verification uses service-owned pinned keys with purpose, tenant, environment, validity and revocation scopes. Self-declared reviewer metadata cannot authorize anything.
- Every submitted record binds source, Git SHA, tenant, environment, actual artifact bytes, collector and run. Review and approval derive from signed lifecycle events. Replay and duplicate handling are transactional.
- SQLite BEGIN IMMEDIATE, unique revision/request constraints and signed hash chains protect concurrency and audit consistency. Whole-store rollback requires an independently retained checkpoint; GO is blocked without an exact checkpoint match.
- Content-addressed bounded JSON artifacts reject sensitive fields and obvious secret formats. This is a constrained intake format, not a claim that arbitrary logs can be safely redacted. Raw credentials are never accepted.
- Path containment checks reject traversal, symlinks and hardlinks, including database sidecars. Intake and trust directories must be service-owned to prevent hostile directory replacement races. No uploaded code, arbitrary commands, URLs or dynamic adapter imports execute.
- Existing tenant/relationship/ownership authorization and forced RLS remain unchanged. Existing passing identity, lease, integration and rollback behavior is reused. No public content, early-access page, logo or production migration was changed.
- Fingerprints now include lib, migrations and execution sources, closing an omitted-source integrity gap.
- Automated accessibility remains distinct from manual WCAG and assistive-technology assessment. The existing pending manual gate is preserved.
- Hosted runner tests use ephemeral local signing keys and fixtures. They do not confer real authority, attest credential rotation, run model inference or certify actual hosted observations.

External requirements: administrator-managed trust/ACLs; independent approvers; approved consent; credential-rotation attestation without rotating credentials in this task; dedicated restricted hosted identity/database; synthetic integration fixtures; reviewed endpoint adapters; approved deployment/rollback scope; security approval; explicit production approval.
