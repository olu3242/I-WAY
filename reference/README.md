# reference/ — INTERNAL

`figma-make-prototype/` is the working prototype exported from the "Logistics App Design" Figma Make file: four applications (Driver, Carrier Admin, Fleet Company, Platform Admin) with sample data and test accounts held in memory.

- It illustrates flows and screens agreed in the design pass. It is **not** production code: no backend, real authentication, persistence or tenant isolation.
- Its theme (dark, amber) predates the I-way Brand Kit and must be re-themed (PRD FR-DS-01).
- Its landing page exposes internal structure and must **never** be used publicly; the public site is `site/public`.
- The large source PDFs and screenshots imported by the prototype (proposal, rebuild documentation, UI design, style guide) were omitted from this copy; keep them with the original Make file.
- Test accounts in `src/context/AuthContext.tsx` are demo-only credentials.

Run (optional): `cd figma-make-prototype && pnpm install && pnpm dev`.
