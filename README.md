# Choice & Cosmos

A local-first reflective guide that walks a person through the Context, Cosmos, Contrast, Choice, and Continuity loop: state what's on your mind, read a reflective interpretation, see the evidence behind it, decide which next steps to keep, and close with a session summary. Nothing here is a prediction. The app is a guide, not a command, and it says so on every screen that offers an interpretation.

This is the Choice & Cosmos WebMCP Challenge build through P5 plus V3-1 trust, V3-2 packet adoption, the V3-3 studio, and V3-4 agent-native tools. The React and TypeScript loop, a labeled legacy fixture, adopted `ReadingPacketV1` readings, local consent-gated IndexedDB persistence (`StoredSessionV3`), a static WebMCP tool catalog behind `document.modelContext` feature detection, digest-bound confirmations, nested self-supplied belief modules, and an adaptive on-page report all live here. Hosted Gemini/D1 research is unmounted from `src/` and `worker/`. Residue under `server/research/` is not on the active path. The UI still runs in the browser with made-up, non-sensitive sample data. There is no birth date, birth time, or birth location field anywhere in the app. The eight WebMCP tools do not send research.

## What this preview demonstrates

- **Context.** Pick a horizon (daily Signal, weekly Compass, or yearly Constellation), name what's actually on your mind, and pick a tone. You may also enter self-supplied belief-system fields (western placements, numerology numbers, Chinese animal or element, BaZi Day Master, Human Design). Those fields stay absent unless you choose them. The app never infers them and never asks for a birth date, birth time, or birth location. Open the cosmos stays off until you add a focus and at least one self-supplied belief-system module.
- **Cosmos.** A forecast cockpit for the chosen horizon (Signal, Compass, or Constellation), plus the sections in the current reading. An adopted packet wins when one is present. A fixture-only loop still works and shows a visible `legacy` badge. Each section is labeled as an interpretive guide or a reflective framework, never as fact. Grounded source notes sit apart from the reflective interpretation. After the reflection, the section shows the cited evidence IDs and source cards, or an explicit note when none were cited. Fixture cards have no live URL. Adopted cards keep the packet https URL. Skipped-lens copy appears for adopted packets. When a focus and at least one belief module are present, Cosmos also shows the exact research brief and a copy-to-agent prompt. You can paste a `ReadingPacketV1` JSON object. Import uses the shared coordinator and does not adopt the packet.
- **Contrast.** The same cockpit, deterministic integer charts with a visible table, a first-class uncertainty state (`unavailable`, `partial`, or `ready`), a coverage summary that is never exhaustive, and an evidence rail with stable IDs and provenance. Each rail card shows its ID and the section titles that cite it. Fixture copy still says it did not search the internet. An adopted packet is a reviewed submission, not an exhaustive search. Paste import, batch progress, validation review, supported and skipped systems, and Adopt live here. A compatible agent can submit a `ReadingPacketV1` for you to review and adopt. Adoption needs an on-page Approve. You can leave Contrast with an adopted reading even when no fixture exists for that horizon.
- **Choice.** Suggested next steps drawn from your stated focus, plus a form to add or remove your own steps. Visible reading sections also have Resonates / Not for me / Unsure controls. Those marks are human-only. They are not a WebMCP tool. Accept, dismiss, or annotate each plan step. Fixture steps cannot be removed. Nothing is pre-selected for you. Leaving Context and opening the same horizon again keeps those accepts, notes, and custom steps. An explicit regenerate still resets fixture steps to proposed. If you already granted local save, resonance and adopted readings persist with the rest of `StoredSessionV3`.
- **Continuity.** A session summary of what you kept, plus an honest note about saving. Adopted sessions show the packet digest and adopted time. From an adopted reading you can print a report or download a calendar of accepted steps. Fixture-only sessions stay on the receipt. Print and calendar stay on this device. There is no account, no cloud, and no calendar API. If you opted in, this browser keeps a copy until you erase it. If you did not, a reload starts over.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # type-check with tsc and produce a production build
npm run lint      # oxlint
npm test -- --run
```

The reproducible demo path, including expected states, is `docs/DEMO.md`. Native Chrome WebMCP is verified locally when Chrome exposes `document.modelContext.registerTool`. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred. Hosted research is not mounted on the Worker. A public live Gemini demo is not claimed.

## What still stays out of the browser

P0 shipped the foundation and fixture preview. P1 added local, consent-gated, revocable IndexedDB persistence and a choice-plan editor. P2 adds agent tools when the browser exposes `document.modelContext.registerTool`. The screens still work by hand when that API is missing. P3 added a server-only research adapter that V3-1 unmounted from the Worker and browser path.

- WebMCP tools are registered only after feature detection. The catalog is static: session status, consented profile access, profile-update proposals, the exact research brief, bounded packet submit, concise reading inspection, proposed choice steps, and plan-save confirmation. Profile reads use an exact field allowlist. Confirmation ids are digest-bound to the payload. Tools cannot approve or deny. Session status reports whether an adopted reading or a memory-only staged packet is present, and names manual import as the fallback when the host is unavailable.
- Personal profile reads, profile diffs, research briefs, packet adoption, and plan saving cannot complete without an on-page Approve. Deny is honored. An agent cannot adopt a packet or accept choice steps.
- No client bundle contains a Gemini key, an `x-goog-api-key` header, or the server adapter. No registered tool shares data or sends research.
- The on-page reading uses local fixture evidence unless you adopt a reviewed packet. Hosted Gemini/D1 execution is not on the `src` or `worker` path.
- No account system or cloud sync. The Worker serves SPA assets only. The browser still must not hold `GEMINI_API_KEY`.
- No raw birth date, birth time, or birth location is collected anywhere in the current P0 through P5 scope. Optional cosmic fields are human-entered closed enums. The app never infers them. Any later approved phase that added optional personal-data access would require explicit, confirmed consent.
- No lottery-style probabilities, fake precision, deterministic predictions, or medical or financial advice.

P1 stores a session only after you opt in, only in this browser profile, and only until you turn it off and erase it. An opted-in copy includes horizon, focus, tone, self-supplied belief fields, adopted readings, and generated forecasts and plans. Writes use `StoredSessionV3`. Stored v1 and v2 documents migrate on read. Staged packets and confirmation tickets are not stored. A present session that fails parse is held, not overwritten. An agent plan-save confirmation is a separate Approve on a modal dialog. Other page controls stay inert until you Approve or Deny. Turning on the local copy is a second checkbox on that dialog, not implied by the plan approval. Confirmation ids are digest-bound to the payload.

## Project layout

- `src/domain/` holds the typed data model, the phase state machine (`types.ts`, `loop.ts`, `profile.ts`, `trust.ts`, `cosmic.ts`), and the studio derivation (`studioView.ts`). This is the one place that encodes what a phase, a horizon, a belief module, a choice step, or a grounded versus reflective claim is; everything else reads from it.
- `src/fixtures/` holds the local sample data and the deterministic `generateForecast` function that turns a horizon and a short focus statement into a fixture forecast. Every report section receives at least one evidence ID from the used pool.
- `src/persistence/` holds the IndexedDB wrapper. Saving starts only after explicit consent.
- `src/webmcp/` holds feature detection, the static tool catalog, and confirmation-gated tool handlers.
- `src/research/` holds the typed research contract, `ReadingPacketV1` parse, the V3-2 coordinator (exact brief, bounded intake, review), horizon caps, and a client that reports hosted research unavailable without fetching. It has no API key.
- `server/research/` holds the historical Gemini adapter and D1 quota code. It is not imported by the browser bundle or the Worker.
- `worker/index.ts` serves SPA assets only. It does not mount `/api/research`.
- `db/0001_quota_counters.sql` is a local quota-schema artifact. This package does not apply D1 migrations or change `wrangler.jsonc`.
- `src/components/` holds the five phase screens, `StudioShell`, the local-saving control, the agent confirmation bar, source cards, `ChartFigure`, and Contrast packet copy.
- `src/styles.css` holds the studio grid, serif reading type, sans controls, and 120 / 180 / 280 ms motion. Color follows `prefers-color-scheme`. There is no in-app theme toggle.

See `SPEC.md` for the full data shapes and the non-negotiable product constraints this build follows.

## Roadmap

P0 shipped the foundation and fixture preview. P1 added local persistence and a fuller manual slice. P2 adds WebMCP tools with confirmation gates and a manual fallback. P3 added a server-only Gemini Search adapter. V3-1 unmounted that adapter from `src/` and `worker/`. Residue stays under `server/research/` and `db/` and is not imported by the browser bundle or the Worker. P4 connects fixture evidence to all eleven sections, labels grounded notes apart from reflective interpretation, and draws deterministic client-side charts. P5 hardens accessibility, privacy and security docs, WebMCP fallback tests, a demo walkthrough, and credential-free CI. Contrast does not POST `/api/research`. Native Chrome WebMCP is verified locally. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred. A verified live Gemini credential remains deferred. The full plan lives in the project's GoalBuddy board under `docs/goals/choice-and-cosmos-webmcp/`, which this slice does not modify.

## P3 research adapter

The browser never holds a provider key. Isolated handler tests may inject a fake `GEMINI_API_KEY` into `handleResearchRequest`. Do not put a key value in the client, a fixture, a log, or a commit. Documented environment-variable names are `GEMINI_API_KEY`, `RESEARCH_ENABLED`, and `QUOTA_HASH_SECRET`.

When that variable is set on the reusable server adapter and live research is enabled with quota prerequisites, `handleResearchRequest` in `server/research/handler.ts` may call the official Gemini Interactions API with `tools: [{ type: "google_search" }]`. This checkout does not configure a live credential. Tests inject `fetch` and a fake key. Live Gemini needs `RESEARCH_ENABLED=true`, a server-only key, a quota hash secret, a D1 quota store, and a trusted `CF-Connecting-IP` identity. Default-off enablement fails closed.

Explicit fixture mode uses local fixture evidence. Fixture sources have no live http(s) links. Auto mode does not fall back to fixture when live prerequisites are missing. Manual mode validates user-supplied http(s) URLs, deduplicates them, applies the same caps, and does not fetch or send page content.

Horizon caps, always reported as non-exhaustive:

| Horizon | Sources | Queries | Novel domains | Time |
| --- | --- | --- | --- | --- |
| daily | 6 | 4 | 4 | 20 seconds |
| weekly | 10 | 6 | 6 | 30 seconds |
| yearly | 14 | 8 | 8 | 45 seconds |

Outcomes for the Contrast V1 result remain `ready`, `partial`, `unavailable`, `cancelled`, `timed_out`, and `error`. Personalized bundles add `disabled`, `quota_exceeded`, `provider_error`, and `invalid_provider_output`. Retrieved text is stored as data. It is never executed and cannot widen caps, override consent, or expose the key.

The Worker in `worker/index.ts` serves SPA assets only. It does not mount `handleResearchRequest`. Live Gemini is not on the active product path. Isolated handler tests may still inject a fake key into the unused `server/research` adapter. Contrast does not show a Gemini Search control and does not POST `/api/research`. The V3-4 catalog does not register `request_external_share`. No WebMCP tool sends research or shares data.

## V2-2 research brief and quota boundary

V2-2 adds versioned `ResearchBrief` and `PersonalizedResearchBundle` contracts shared by Gemini and later agent evidence. A brief contains only horizon, focus, tone, approved cosmic profile fields, and requested lenses. Display names, birth date/time/place, accounts, raw IP, and arbitrary provider instructions are rejected. Grounded claims must carry normalized `ev_` plus 16-hex source IDs. Unsupported lenses are skipped rather than filled. Bundle statuses are `ready`, `partial`, `unavailable`, `disabled`, `cancelled`, `timed_out`, `quota_exceeded`, `provider_error`, `invalid_provider_output`, and `invalid_input`.

Anonymous D1 quota rows in the unused `db/` artifact store only `day`, `bucket`, `hash`, and `counter`. V3-1 does not apply that quota path. Agent packet submission and visible adoption are in V3-2. V3-4 owns the eight-tool catalog. Hosted Gemini remains unmounted.

## P4 synthesis and charts

P4 kept the stored `ForecastFixture` shape. V3-3 moves that derivation into `src/domain/studioView.ts`. Fixture cards still have `url: null`. They never invent live links. Astrology, numerology, Human Design, tarot and oracle, elemental, and symbolic sections are labeled as interpretive guides. Other sections are labeled as reflective frameworks. Grounded source notes and reflective interpretation are separate headings.

Fixture charts are SVG plus a table. Daily has four window parts, weekly has seven days, yearly has four seasons. Bar heights are integer counts. They are not probabilities and not a prediction. `Math.random()` is not used.

The screens still work by hand when WebMCP is missing. They do not import `server/`. Contrast does not call `/api/research`.

## P5 hardening

P5 does not change the loop or the stored forecast shape. It makes the existing preview safer to demo. V3-4 owns the tool catalog.

**Setup.** `npm install`, `npm run dev`, `npm test -- --run`, and `npm run build`. CI in `.github/workflows/ci.yml` runs those checks with `npm ci`. No repository secrets are required.

**Privacy.** Typed focus text, tone, optional human-entered cosmic fields, and optional local IndexedDB stay in this browser profile. There is no account and no cloud sync. Decline remembers the preference and stops future saving without erasing any existing stored session. Clear erases the local session and the consent flag. No WebMCP tool shares data.

**Consent.** Profile read, research brief, profile update, packet adoption, and plan save wait for on-page Approve. Deny is a first-class result. Local saving is a separate checkbox on plan save. Contrast has no Gemini Search confirmation.

**Security and untrusted input.** Web pages, search snippets, titles, and agent arguments are data. They never become tool policy, never raise caps, and never skip consent. Fixture and manual notes are rendered as text.

**Server secrets.** `GEMINI_API_KEY`, `x-goog-api-key`, and `server/` stay out of the client bundle. Docs may name the environment variable. They must not include a key value.

**Local fallback.** Missing WebMCP keeps the screens complete. Native Chrome WebMCP is verified locally when `document.modelContext.registerTool` is present. Hosted research is unmounted. Explicit fixture copy still says no live search occurred. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred. A public live Gemini demo remains deferred.

**Accessibility.** A skip link targets `#main-content`. Chart slots also appear in a visible HTML table so narrow widths stay readable. Report sections keep native disclosure. Evidence heading ids stay unique across sections.

## V3-3 studio

`studioView(state)` is the one derivation the page renders. Phases take `StudioPhaseProps` and do not import `ForecastFixture` or `ReadingArtifact`. An adopted reading for the current horizon wins. Otherwise the fixture shows with a `legacy` badge. Cosmos and Contrast can advance when either is present.

Adopted weekly packets render whatever sections they hold, plus skipped-lens copy. They do not merge up to eleven lenses. Charts are integer `value` slots. Adopted packets get a citation-count chart and, when `beliefs.bazi.elementCounts` exists, an element chart that omits missing keys. Fixture packets keep the window map. Captions deny probability, confidence, energy percent, and invented dates.

Choice writes `SET_RESONANCE` for visible section ids only. The action is not a `ToolAction`. Autosave in `PersistenceBar` watches `readingsByHorizon` and `resonanceByHorizon` along with the rest of `SessionFields`. Schema version stays 3. Continuity may show an adopted receipt. An adopted reading can print and can download an `.ics` of accepted steps, capped Daily 3 / Weekly 7 / Yearly 4. A fixture session does not get those controls.

Desktop layout is a stage rail, reading canvas, and evidence aside. Mobile is one column with a sticky stage nav. Color follows `prefers-color-scheme`. There is no theme toggle.

See `docs/DEMO.md` for the exact walkthrough.
