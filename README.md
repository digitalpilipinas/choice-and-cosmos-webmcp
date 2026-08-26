# Choice & Cosmos

A local-first reflective guide that walks a person through the Context, Cosmos, Contrast, Choice, and Continuity loop: state what's on your mind, read a reflective interpretation across eleven frameworks, see the evidence behind it, decide which next steps to keep, and close with a session summary. Nothing here is a prediction. The app is a guide, not a command, and it says so on every screen that offers an interpretation.

This is the Choice & Cosmos WebMCP Challenge build through P5: the React and TypeScript foundation, a fixture and manual preview, local consent-gated IndexedDB persistence, a static WebMCP tool catalog behind `document.modelContext` feature detection, a server-only Gemini Search research adapter with fixture and manual fallback, on-page synthesis across eleven report sections, deterministic horizon charts with a visible HTML catalog table, and release-candidate hardening for accessibility, privacy docs, WebMCP fallback, and CI. The UI still runs entirely in the browser with made-up, non-sensitive sample data. There is no birth date, birth time, or birth location field anywhere in the app. External-share approval is recorded only and never sends data. Live research is not mounted in the screens or the T004 tools.

## What this preview demonstrates

- **Context.** Pick a horizon (daily Signal, weekly Compass, or yearly Constellation), name what's actually on your mind, and pick a tone. No personal data beyond what you choose to type.
- **Cosmos.** A forecast cockpit for the chosen horizon (Signal, Compass, or Constellation), plus eleven interpretive sections. Each section is labeled as an interpretive guide or a reflective framework, never as fact. Grounded source notes sit apart from the reflective interpretation. After the reflection, the section shows the cited evidence IDs and source cards, or an explicit note when none were cited.
- **Contrast.** The same cockpit, a deterministic window chart, a first-class uncertainty state (`unavailable`, `partial`, or `ready`, with fixture or manual source), a coverage summary (sources considered, sources used, time window, stopping reason), and source cards with stable IDs and provenance. Each card shows its ID and the section titles that cite it. The page states that live research is not mounted, so the app never implies it searched the internet.
- **Choice.** Three suggested next steps drawn from your stated focus, plus a form to add or remove your own steps. Accept, dismiss, or annotate each one. Fixture steps cannot be removed. Nothing is pre-selected for you. Leaving Context and opening the same horizon again keeps those accepts, notes, and custom steps. An explicit regenerate still resets fixture steps to proposed.
- **Continuity.** A session summary of what you kept, plus an honest note about saving. If you opted in, this browser keeps a copy until you erase it. If you did not, a reload starts over.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # type-check with tsc and produce a production build
npm run lint      # oxlint
npm test -- --run
```

The reproducible demo path, including expected states, is `docs/DEMO.md`. Live WebMCP, ChatGPT Sites, and Gemini mounting remain deferred until a host is verified.

## What still stays out of the browser

P0 shipped the foundation and fixture preview. P1 added local, consent-gated, revocable IndexedDB persistence and a choice-plan editor. P2 adds agent tools when the browser exposes `document.modelContext.registerTool`. The screens still work by hand when that API is missing. P3 adds a server-only research adapter. P4 connects fixture evidence to the eleven sections and draws client-side charts. The screens still do not call the research handler.

- WebMCP tools are registered only after feature detection. The catalog is static: session status, consented profile access, profile-update proposals, forecast generation, evidence inspection, choice-plan drafting, plan-save confirmation, and external-share confirmation.
- Personal profile reads, profile diffs, external sharing, and plan saving cannot complete without an on-page Approve. Deny is honored.
- No client bundle contains a Gemini key, an `x-goog-api-key` header, or the server adapter. External-share approval is stored as `approved_not_sent` and still does not send data.
- Research without `GEMINI_API_KEY` uses local fixture evidence. Manual mode accepts user-supplied http(s) links, caps them, and does not fetch or forward their content.
- No account system or cloud sync. The app never sends your input anywhere from the browser.
- No raw birth data collection, ever, at any phase.
- No lottery-style probabilities, fake precision, deterministic predictions, or medical or financial advice.

P1 stores a session only after you opt in, only in this browser profile, and only until you turn it off and erase it. An agent plan-save confirmation is a separate Approve on a modal dialog. Other page controls stay inert until you Approve or Deny. Turning on the local copy is a second checkbox on that dialog, not implied by the plan approval.

## Project layout

- `src/domain/` holds the typed data model, the phase state machine (`types.ts`, `loop.ts`), and the P4 synthesis view models (`synthesis.ts`). This is the one place that encodes what a phase, a horizon, a choice step, or a grounded versus reflective claim is; everything else reads from it.
- `src/fixtures/` holds the local sample data and the deterministic `generateForecast` function that turns a horizon and a short focus statement into a fixture forecast. Every report section receives at least one evidence ID from the used pool.
- `src/persistence/` holds the IndexedDB wrapper. Saving starts only after explicit consent.
- `src/webmcp/` holds feature detection, the static tool catalog, and confirmation-gated tool handlers.
- `src/research/` holds the typed research contract and horizon caps. It has no API key and no network client.
- `server/research/` holds the Gemini Interactions adapter, fixture/manual fallback, response normalization, and a platform-neutral `Request`/`Response` handler. It is not imported by the browser bundle.
- `src/components/` holds the five phase screens and shared UI (the phase stepper, the free-will banner, the local-saving control, the agent confirmation bar, source cards, and the horizon chart).

See `SPEC.md` for the full data shapes and the non-negotiable product constraints this build follows.

## Roadmap

P0 shipped the foundation and fixture preview. P1 added local persistence and a fuller manual slice. P2 adds WebMCP tools with confirmation gates and a manual fallback. P3 adds a server-only Gemini Search adapter with fixture and manual fallback, bounded caps, provenance, and cancellation states. P4 connects fixture evidence to all eleven sections, labels grounded notes apart from reflective interpretation, and draws deterministic client-side charts. P5 (this slice) hardens accessibility, privacy and security docs, WebMCP fallback tests, a demo walkthrough, and credential-free CI. Live research is still not mounted. The full plan lives in the project's GoalBuddy board under `docs/goals/choice-and-cosmos-webmcp/`, which this slice does not modify.

## P3 research adapter

The browser never holds a provider key. Set `GEMINI_API_KEY` only in the server environment. Do not put a key value in the client, a fixture, a log, or a commit. The optional name `GEMINI_API_KEY` is the only secret-related identifier this repo documents.

When that variable is set, `handleResearchRequest` in `server/research/handler.ts` may call the official Gemini Interactions API with `tools: [{ type: "google_search" }]`. This run does not make that live call. Tests inject `fetch` and a fake key.

When the variable is missing, research uses local fixture evidence. Fixture sources have no live http(s) links. Manual mode validates user-supplied http(s) URLs, deduplicates them, applies the same caps, and does not fetch or send page content.

Horizon caps, always reported as non-exhaustive:

| Horizon | Sources | Queries | Novel domains | Time |
| --- | --- | --- | --- | --- |
| daily | 4 | 3 | 3 | 12 seconds |
| weekly | 5 | 4 | 4 | 15 seconds |
| yearly | 6 | 4 | 5 | 18 seconds |

Outcomes are `ready`, `partial`, `unavailable`, `cancelled`, `timed_out`, and `error`. Retrieved text is stored as data. It is never executed and cannot widen caps, override consent, or expose the key.

The handler accepts POST JSON. It does not add CORS or authentication. Hosting and UI wiring stay out of this slice.

Honest limits: no live Gemini call is configured in this checkout, the screens still show fixture forecasts, live research is not mounted, and `request_external_share` still records `approved_not_sent` without sending.

## P4 synthesis and charts

P4 keeps the stored `ForecastFixture` shape. `src/domain/synthesis.ts` derives source cards and a horizon chart from that fixture. Fixture cards have `url: null`. They never invent live links. Astrology, numerology, Human Design, tarot and oracle, elemental, and symbolic sections are labeled as interpretive guides. Other sections are labeled as reflective frameworks. Grounded source notes and reflective interpretation are separate headings.

The chart is SVG in the browser. Daily has four window parts, weekly has seven days, yearly has four seasons. Bar heights are integer catalog weights. They are not probabilities and not a prediction. `Math.random()` is not used.

The screens still work by hand when WebMCP is missing. They do not import `server/` and they do not call the research handler.

## P5 hardening

P5 does not change the loop, the eight-tool catalog, or the stored forecast shape. It makes the existing preview safer to demo.

**Setup.** `npm install`, `npm run dev`, `npm test -- --run`, and `npm run build`. CI in `.github/workflows/ci.yml` runs those checks with `npm ci`. No repository secrets are required.

**Privacy.** Typed focus text, tone, and optional local IndexedDB stay in this browser profile. There is no account and no cloud sync. Decline and Clear erase the local copy. External share approval is `approved_not_sent`.

**Consent.** Profile read, profile update, plan save, and external share wait for on-page Approve. Deny is a first-class result. Local saving is a separate checkbox on plan save.

**Security and untrusted input.** Web pages, search snippets, titles, and agent arguments are data. They never become tool policy, never raise caps, and never skip consent. Fixture and manual notes are rendered as text.

**Server secrets.** `GEMINI_API_KEY`, `x-goog-api-key`, and `server/` stay out of the client bundle. Docs may name the environment variable. They must not include a key value.

**Local fallback.** Missing WebMCP keeps the screens complete. Missing `GEMINI_API_KEY` uses fixture evidence with `url: null`. Live research, ChatGPT Sites, and a live Gemini mount are deferred until verified.

**Accessibility.** A skip link targets `#main-content`. Chart slots also appear in a visible HTML table so narrow widths stay readable. Report sections keep native disclosure. Evidence heading ids stay unique across sections.

See `docs/DEMO.md` for the exact walkthrough.
