@AGENTS.md

# Claude-specific notes

- Treat `docs/` and `reference/` as confidential context. Use them to inform internal work; never paraphrase them into anything under `site/`.
- Before writing public copy, re-read the "Public vs. private" table in `docs/IP_DISCLOSURE_REVIEW.md`.
- When a requirement is missing or conflicting, add it to PRD §20 (Open questions) instead of inventing an answer.
- After editing `site/`, run `npm run verify` and fix failures rather than loosening the scan list.
- For any visual or copy decision, consult `docs/brand/BRAND_NOTE.md` first, then the full guidelines. The concept board in the brand kit is mood only: never copy its statistics, partner logos or AI claims.
