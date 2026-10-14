# Accessibility and performance checklist (public site)

Status key: ✅ built and checked here · 🔲 verify before release.

## Accessibility (target WCAG 2.2 AA)
| Item | Status |
|---|---|
| `lang` on every page; one `h1` per page; logical heading order (automated: `npm run check`) | ✅ |
| Skip link; visible 3px focus ring; all controls keyboard operable; Escape closes the mobile menu | ✅ |
| Form: every control has a `label for`; errors have text, not colour alone; `aria-invalid`; focus moves to first error and to the success panel | ✅ |
| Landmarks: header, nav (labelled), main, footer | ✅ |
| Decorative SVG `aria-hidden`; informative graphics use `role="img"` with description | ✅ |
| FAQ uses native `details/summary` (keyboard and screen-reader friendly) | ✅ |
| Contrast: Navy on White 15.5:1; Blue on White 5.2:1; **Navy on Orange 5.3:1 (white on Orange is 2.9:1 and is not used)**; muted text #475569 on White 7.6:1; footer link #D3E2F6 on #061A36 > 11:1 | ✅ (computed) |
| `prefers-reduced-motion` disables animation and reveal transitions | ✅ |
| Touch targets ≥ 44 px (buttons 48–56 px) | ✅ |
| Works without JavaScript (nav visible, FAQ native; form needs JS and says so by design) | 🔲 add `<noscript>` message on early-access |
| Screen reader pass (NVDA/VoiceOver) on all pages | 🔲 |
| Zoom to 200% and 400% reflow; text spacing override | 🔲 |
| Automated axe/Lighthouse run on every page | 🔲 |

## Performance
| Item | Status |
|---|---|
| No framework, no build dependency; one CSS file, two small scripts | ✅ |
| System-font fallback stack while Inter loads (`display=swap`) | ✅ |
| Images are inline SVG; no raster hero assets | ✅ |
| No horizontal overflow at 390 px and 1440 px | ✅ |
| Budget: LCP < 2.5 s, CLS < 0.1, INP < 200 ms on mid-range mobile | 🔲 measure |
| Self-host Inter (removes third-party font request) and add caching headers | 🔲 |
| Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`) at the host | 🔲 |
| Sitemap and robots policy chosen deliberately (legal pages are `noindex` drafts) | 🔲 |

## Release gate
`npm run verify` (build + IP scan + link/a11y static checks) must pass, then the signed review in `IP_DISCLOSURE_REVIEW.md`.
