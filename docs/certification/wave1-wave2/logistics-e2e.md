# Local logistics integration

The existing execution statuses remain stable for billing and existing callers. New writes persist lifecycleState: draft, validated, ready (validated + readyAt), assigned, dispatched (accepted/picked_up), in_transit, delivered, closed (delivered + closedAt), or cancelled (void). Existing stored records remain readable without migration. Ready is an explicit optional milestone for backward compatibility; assignment of previously validated records remains permitted. Closed requires no open operational exception, current validated intact BOL, and immutable acknowledged POD for every delivery stop. Load and shipment milestones change in one transaction with command receipts and audit evidence.

Assignment cancellation is human-authorized before pickup, ends the active claim, clears assignment fields and permits eligible reassignment. Existing driver principal, carrier approval, compliance expiry, capacity, fleet and availability rules remain authoritative. The two-tenant HTTP journey uses capacity recommendation, independent carrier approval and approved application.

Tracking accepts optional UTC occurredAt and externalId, stores server recordedAt and human_reported provenance, detects conflicting duplicate IDs, and retains out-of-order facts. It never infers a shipment transition from unverified location evidence. Customer tracking remains a redacted milestone. Signed provider inbox events remain unapplied evidence under the existing human-control contract.

All eight requested exception categories reuse persisted workflows, bounded retry, approval expiry/replay fencing and human recovery. Pre-dispatch and delivered exception intake is supported; recovery with assigned equipment revalidates eligibility. No automatic operational consequence or regulatory eligibility rule was invented.

New lifecycle notification templates require explicit local preference opt-in. Existing delivery/invoice/document preference behavior remains compatible. Notifications derive minimal metadata from committed audit events, use template version 1, authorize recipients again before local recording, preserve retry/dead-letter semantics and never send externally. This local preference is not approval of legal consent language or a live communication policy.

Evidence: b191-b196-focused.log (6/6 at intermediate snapshot), b191-b199-focused-fixed.log (27/28; the one failure was a test assuming a tenant field absent from the redacted audit API), b199-http-fixed.log (1/1, corrected sequence membership assertion). Final verify/browser results supersede intermediate snapshots; failed logs are retained.

Final source implementation commit: 6dea4ca. Full verification passes 399/399. Browser suite passes 11/12; new ready/cancel control coverage passes, while the unchanged broad accessibility sweep times out at 180 seconds. All 55 completed accessibility scans report zero violations; manual review and the incomplete sweep remain outstanding.
