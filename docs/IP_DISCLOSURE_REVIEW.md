# IP-disclosure review (public copy and source)

Required before any public release (directive §6). Automated scan: `npm run scan:ip` (a safety net, not a substitute for review).

## What the public site must never reveal
Product strategy or market-entry plans · proprietary AI agents, orchestration, prompts or decision logic · technical architecture, schemas, infrastructure · routing, pricing, matching or optimization algorithms · internal workflows, approval logic, automation rules · financial models, margins, commercial assumptions · roadmap, unannounced features, confidential integrations · security implementation or internal controls.

## Public vs. private

| Public (site/public) | Private (docs/, reference/) |
|---|---|
| What I-way helps customers do | How the technology accomplishes it |
| Simple shipment experience | Internal shipment orchestration |
| Tracking and visibility | Data processing and intelligence models |
| Customer benefits | Proprietary algorithms |
| Easy registration | Identity and permission architecture |
| Clear pricing, when approved | Pricing algorithms and margin models |
| Customer trust | Internal security architecture |

## Decisions recorded in this build
- Platform Admin, hierarchy diagrams, epic/rule counts and "AI-native" wording from earlier prototypes are **not** on the public site.
- Prototype statistics ("1,248 shipments", "98% on-time", "Live concept") removed; preview data is labelled illustrative.
- FAQ cost answer says pricing is unpublished; no figures.
- Phone/mobile answer makes no commitment about a mobile app.
- Social links omitted until approved. Legal pages are placeholders until counsel approves.
- `config.js` ships to browsers: it holds only public endpoints; never secrets.

## Review checklist
- [ ] Every sentence describes a customer outcome or a verified capability
- [ ] No numbers other than clearly labelled sample data
- [ ] No claims of certification, security guarantees, testimonials, customers
- [ ] View-source and all files in `site/public` reviewed (comments, ids, class names, alt text, config)
- [ ] `npm run scan:ip` passes
- [ ] Deploy artifact contains only `site/public`

| Reviewer | Role | Date | Result |
|---|---|---|---|
| | Product | | |
| | Legal | | |
| | Brand | | |
