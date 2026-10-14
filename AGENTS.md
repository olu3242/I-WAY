# AGENTS.md — I-way

Instructions for AI coding agents and human contributors. Canonical file; `CLAUDE.md` imports it.

## What this repository is
- `site/` — the **public** I-way conversion website (static HTML/CSS/JS, no dependencies). Only `site/public` is ever deployed.
- `docs/` — **INTERNAL** product documents (PRD, BRD, architecture, checklists). Never deploy, never copy into `site/`.
- `reference/figma-make-prototype/` — **INTERNAL** React prototype of the four applications. Flow reference only: in-memory state, test accounts, no real auth or backend. Do not ship it.
- `scripts/` — zero-dependency Node tooling.

## Non-negotiable rules
1. **Public/private boundary.** Public pages show customer outcomes only. Never put strategy, AI/agent mechanics, architecture, algorithms, pricing logic, settlement rules, roadmap, margins or security details in `site/`. Run `npm run verify` before every commit that touches `site/`.
2. **No invented facts on public pages**: no statistics, customers, testimonials, certifications, security guarantees, prices, dates or social links unless approved and recorded in `docs/IP_DISCLOSURE_REVIEW.md`. Sample data must be labelled illustrative.
3. **Brand.** Rules live in `docs/brand/` (guidelines, brand note, tokens). Use `site/public/assets/brand/*` unmodified (do not recolour, invert, crop or redraw the logo; on dark backgrounds place it on a white chip). Tokens: Navy #092448, Blue #1261F3, Cyan #00BCE8, Orange #FF681C, Amber #FFB000, Cloud #F5F8FC, Ink #111827; Inter; radii 20 px card / 12 px button.
4. **Contrast.** Never use white text on Orange (2.9:1). Orange buttons use Navy text.
5. **Honesty in conversion.** While no sign-up service is configured the form runs in preview mode and says so. No fake scarcity, no fabricated social proof, no forced account creation.
6. **Product rules (internal apps).** One owner per function. Enforce BR-001…BR-020 (docs/PRD.md §5.5) and the authorization model: role + permission + tenant + relationship + resource ownership. Audit every BR-012 action. Deactivate, never hard-delete. Store UTC; evaluate in carrier time zone.
7. **Sensitive data.** SSN, ID images, bank and tax data: never log, never put in URLs, events, fixtures or screenshots.

## Commands
| Command | Purpose |
|---|---|
| `npm run site:build` | Assemble `site/src/pages` + `site/src/partials` into `site/public` |
| `npm run site:serve` | Preview at http://localhost:4173 |
| `npm run scan:ip` | Fail if public files contain internal-only terms |
| `npm run check` | Link, anchor, alt, label, heading and icon checks |
| `npm run verify` | Build + scan + check (release gate) |
| `npm run docs:docx` | PRD/BRD to Word in `dist/` (needs pandoc) |
| `npm run diagrams` | Render Mermaid diagrams (needs network + browser) |

## Editing the site
Edit `site/src/pages/*.html` and `site/src/partials/*.html`, then build; never hand-edit `site/public/*.html` (regenerated). CSS is `site/public/assets/css/styles.css`; runtime config is `site/public/assets/js/config.js` (public values only).

## Conventions
- Semantic HTML, one `h1` per page, labels on every control, no `href="#"`.
- Events follow `docs/CONVERSION_EVENTS.md`; never include user input in event parameters.
- Mark unresolved facts `[TBC]` in docs rather than guessing.

## Agent roles (for multi-agent workflows)
| Role | Scope | Must not |
|---|---|---|
| Site builder | `site/` only | Read or quote `docs/` or `reference/` into public copy |
| Copy reviewer | Public copy | Approve any claim not backed by a verified capability |
| Docs author | `docs/` | Contradict PRD business rules without recording a decision |
| App engineer | Applications (future) | Bypass the authorization model or audit |
| Release gate | `npm run verify` + human review | Ship with failing scan |

## Definition of done
Builds; `npm run verify` passes; responsive at 390 px and 1440 px; keyboard-operable; no console errors; docs updated if behaviour or rules changed.
