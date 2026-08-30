# Choice & Cosmos: P0 through P5 specification

This file describes the data model and constraints for the P0 foundation and fixture preview, the P1 local persistence and choice editor, the P2 WebMCP tools, the P3 research adapter, the P4 synthesis and charts, and the P5 hardening. It is the reference for what the code in `src/domain/`, `src/fixtures/`, `src/persistence/`, `src/webmcp/`, `src/research/`, `server/research/`, and `worker/index.ts` must stay true to as later phases build on it.

## The product loop

Every session moves through five phases, in order: Context, Cosmos, Contrast, Choice, Continuity. A person names their horizon and their focus in Context, reads a reflective interpretation in Cosmos, sees the evidence and its limits in Contrast, decides what to keep in Choice, and gets a summary in Continuity. Going back is always allowed. Nothing in Choice is pre-selected or forced.

## Horizons

Three horizons, each with its own name and time window:

| Horizon | Label | Window |
| --- | --- | --- |
| `daily` | Signal | Today into tomorrow morning |
| `weekly` | Compass | The current week |
| `yearly` | Constellation | The current year |

## Data shapes

```ts
type HorizonId = 'daily' | 'weekly' | 'yearly';

type PhaseId =
  | 'context'
  | 'cosmos'
  | 'contrast'
  | 'choice'
  | 'continuity';

interface ContextProfile {
  displayName: string;
  focusIntention: string;
  tone: 'grounded' | 'curious' | 'bold';
}

interface CosmicProfile {
  sunSign?: ZodiacSign
  moonSign?: ZodiacSign
  risingSign?: ZodiacSign
  humanDesignType?: HumanDesignType
  humanDesignAuthority?: HumanDesignAuthority
  humanDesignProfile?: HumanDesignProfile
  lifePath?: LifePathNumber
  chineseZodiacAnimal?: ChineseZodiacAnimal
  chineseElement?: ChineseElement
}

interface DerivedProfile extends ContextProfile {
  cosmic: CosmicProfile
}

type ProfileField = keyof ContextProfile

type ReportSectionId =
  | 'energyOverview' | 'numerology' | 'humanDesign' | 'westernAstrology'
  | 'chineseElemental' | 'lifeAreas' | 'decisionSupport' | 'tarotOracle'
  | 'focusActionPlan' | 'symbolicCodes' | 'higherSelfLetter';

interface ReportSection {
  id: ReportSectionId;
  title: string;
  frameworkLabel: string;
  reflection: string;
  evidenceIds: string[];
}

interface EvidenceItem {
  id: string;
  label: string;
  sourceType: 'fixture';
  note: string;
}

type ForecastSource = 'fixture' | 'manual';

interface CoverageSummary {
  sourcesConsidered: number;
  sourcesUsed: number;
  timeWindowDescription: string;
  stoppingReason: string;
  mode: ForecastSource;
}

interface ForecastCockpit {
  horizon: HorizonId;
  name: 'Signal' | 'Compass' | 'Constellation';
  tagline: string;
  windowDescription: string;
  focusIntention: string;
  generatedAt: string | null;
}

type UncertaintyState =
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'partial';
      source: ForecastSource;
      coverage: CoverageSummary;
      limitations: string;
    }
  | {
      kind: 'ready';
      source: ForecastSource;
      coverage: CoverageSummary;
      limitations: string;
    };

type ChoiceStepStatus = 'proposed' | 'accepted' | 'dismissed';

type ChoiceStepOrigin = 'fixture' | 'custom';

interface ChoiceStep {
  id: string;
  title: string;
  rationale: string;
  status: ChoiceStepStatus;
  userNote: string;
  origin: ChoiceStepOrigin;
}

interface ChoicePlanDraft {
  horizon: HorizonId;
  createdAt: string;
  steps: ChoiceStep[];
  freeWillNote: string;
}

interface ForecastFixture {
  horizon: HorizonId;
  generatedAt: string;
  sections: ReportSection[];
  evidence: EvidenceItem[];
  coverage: CoverageSummary;
  suggestedSteps: ChoiceStep[];
}

type PersistenceStatus =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'undecided' }
  | { kind: 'held'; savedAt: string }
  | { kind: 'declined' }
  | { kind: 'saving' }
  | { kind: 'saved'; savedAt: string }
  | { kind: 'error'; operation: 'save' | 'decline' | 'erase'; message: string }

interface StoredSessionV1 {
  schemaVersion: 1
  savedAt: string
  phase: PhaseId
  horizon: HorizonId
  profile: ContextProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

interface StoredSessionV2 {
  schemaVersion: 2
  savedAt: string
  phase: PhaseId
  horizon: HorizonId
  profile: DerivedProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

type AgentAvailability =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready' }

type ConfirmationKind =
  | 'personal_data_access'
  | 'profile_update'
  | 'external_share'
  | 'plan_save'

type ShareInclude = 'profile' | 'forecast' | 'plan'

type ConfirmationPayload =
  | { kind: 'personal_data_access' }
  | { kind: 'profile_update'; proposed: Partial<ContextProfile> }
  | { kind: 'external_share'; destination: 'gemini-research'; include: ShareInclude[] }
  | { kind: 'plan_save'; horizon: HorizonId }

type ConfirmationState =
  | { status: 'idle' }
  | { status: 'pending'; id: string; kind: ConfirmationKind; summary: string; payload: ConfirmationPayload }
  | { status: 'approved'; id: string; kind: ConfirmationKind; payload: ConfirmationPayload }
  | { status: 'denied'; id: string; kind: ConfirmationKind }

type ExternalShareState =
  | { kind: 'none' }
  | { kind: 'approved_not_sent'; destination: 'gemini-research'; include: ShareInclude[]; reason: string }
  | { kind: 'denied'; destination: 'gemini-research' }
```

`DerivedProfile` never carries a birth date, birth time, or birth location. `cosmic` is a nested object of closed enums. The members are `ZODIAC_SIGNS`, `HUMAN_DESIGN_TYPES`, `HUMAN_DESIGN_AUTHORITIES`, `HUMAN_DESIGN_PROFILES`, `LIFE_PATH_NUMBERS`, `CHINESE_ZODIAC_ANIMALS`, and `CHINESE_ELEMENTS` in `src/domain/cosmic.ts`. Absent optional keys mean not provided. The parser does not store null, empty strings, or inferred values. Extra cosmic keys fail parse. Life path is one of 1-9, 11, 22, or 33. It is not a computed value. In-memory `AppState.profile` is always `DerivedProfile` with `cosmic`. `SET_PROFILE_FIELD` is keyed on `ContextProfile` only. `SET_COSMIC_FIELD` with `undefined` deletes that cosmic key. Context `canAdvance` still requires a non-empty focus intention only. Sun sign is not a gate on this fixture loop.

`ForecastCockpit` and `UncertaintyState` are derived view models. They are not stored on `ForecastFixture`, `StoredSessionV1`, or `StoredSessionV2`. `forecastCockpit(horizon, profile, forecast)` takes `name` from `HORIZON_BY_ID[horizon].label` only. `uncertaintyFor(forecast)` is `unavailable` when the forecast is missing, `ready` when `coverage.sourcesUsed` is above zero, and `partial` otherwise. Source comes from `coverage.mode`. Limitations copy says the run used fixture or manual data, not live research, and must not read as a confidence score.

`evidenceForSection(forecast, section)` and `sectionsCitingEvidence(forecast, evidenceId)` map existing `ReportSection.evidenceIds` onto `EvidenceItem.id` in both directions. They do not add stored fields.

`generateForecast(profile, horizon)` is a pure, deterministic function. The same focus text, tone, and horizon always produce the same fixture forecast, seeded by a plain string hash rather than by wall-clock time or `Math.random()`. `generatedAt` is a deterministic clock on 2026-08-27. Relative labels such as Today and Tomorrow stay truthful for this challenge preview. This is a fixture generator, not a research pipeline. P1 still writes `coverage.mode` as `'fixture'`. P3 adds a separate server-side research contract behind `src/research/` and `server/research/`. P4 keeps that on-page forecast and cites every report section from the used fixture pool. Explicit fixture and manual research stay alive rather than deleted. The Worker mounts `/api/research`. Live Gemini is default-off and fail-closed. Contrast POSTs a confirmed focus and horizon only after you approve. Auto mode without live prerequisites returns an explicit disabled or unavailable state and does not become fixture success.

## Non-negotiable constraints

These carry forward from the project's implementation plan and apply to every phase, not only P0.

- Astrology, Human Design, numerology, tarot and oracle, personality, and elemental systems are always labeled as interpretive or reflective frameworks, never as objective certainty.
- No lottery probabilities, no fake precision percentages, no deterministic predictions, no medical diagnosis or treatment, no financial advice.
- No raw birth date, birth time, or birth location is collected in the current P0 through P5 scope. A later approved phase that added optional personal-data access would require explicit, confirmed consent, never silent.
- Personal profile access, profile changes, external sharing, and choice-plan saving all require clear, scoped, revocable confirmation once those features exist. P0 has none of them yet: everything lives in memory for the current session only. P1 adds consent-gated local saving of the session in this browser only. It is still explicit, informed, and revocable. There is still no account and no cloud copy.
- API secrets, once a phase introduces them, stay server-side. Never in a client bundle, a log, a screenshot, a fixture, or a commit.
- Web pages, search results, retrieved documents, and agent arguments are untrusted input once real research exists. Source text never overrides tool policy or a consent boundary.
- Research is bounded by horizon-specific time, source, and novelty limits. The app reports actual coverage and its stopping reason instead of claiming exhaustive internet knowledge, even in fixture mode.
- The UI keeps working by hand when WebMCP is unavailable. P2 feature-detects `document.modelContext.registerTool` and registers a static catalog when it exists. Missing support is an honest unavailable state, not a broken page.
- Charts and forecast data are deterministic and computed client-side. No Python runtime, no Perplexity dependency, no server-side rendering requirement.
- The MVP stays local-first: no account system, no cloud profile sync, and no profile or research-output storage in D1. Anonymous hashed quota counters are allowed as a later approved V2-2 boundary and are not applied in this checkout.

## What P0 explicitly does not build

WebMCP tool registration, Gemini or any other network-backed research, IndexedDB or any other persistence, account or cloud sync, external sharing, raw birth-data collection, and anything that reads as a prediction rather than a reflection. These are scoped to P1 through P5 in the project's GoalBuddy board (`docs/goals/choice-and-cosmos-webmcp/`), which this slice does not touch.

## P1 persistence and choice editor

P1 adds a local session copy and a way to add or remove personal choice-plan steps. It does not add WebMCP, Gemini, raw birth data, an account, or cloud sync.

Saving uses IndexedDB in this browser profile only. Bootstrap never starts a save on its own. The first write happens after the person grants consent. Decline is remembered so the prompt stays quiet and future saving stops, without erasing any existing stored session. A later grant is still allowed. Clear erases the stored session and the consent flag. Nothing is described as synced, shared, backed up, or durable beyond this profile.

`PersistenceStatus` is the live consent and save state. Writes after consent are `StoredSessionV2`. `parseStoredSessionV1` still reads v1 documents. `migrateV1ToV2` copies v1 fields and sets `cosmic: {}`. `parseStoredSession` returns a v2 document, or migrates a valid v1 document, or returns null. A missing session with granted consent is `granted-empty`. A present session that fails parse is `{ kind: 'unreadable'; savedAt }` and maps to `PERSISTENCE_HELD`, so the blob is not overwritten. `savedAt` is the stored string when it is present and non-empty, otherwise `'unreadable'`. `held` means a stored copy exists and this tab is not using it, so that copy was not loaded. `error.operation` is `'save'`, `'decline'`, or `'erase'`. `hasPersistenceConsent` is true for `saving`, `saved`, and `error` except when `operation` is `'decline'`. It is false for `checking`, `unavailable`, `undecided`, `held`, and `declined`. Autosave runs only while consent is true, and it also stays off after an erase failure so the erase control remains. A late `PERSISTENCE_HELD` does not replace `saving`, `saved`, or a save `error`. `RESTART` from `saving`, `saved`, or a save `error` moves persistence to `held` so autosave does not replace the stored session. Late `PERSISTENCE_SAVE_START`, `PERSISTENCE_SAVE_SUCCESS`, and save-operation `PERSISTENCE_SAVE_ERROR` do not replace `held`. An in-flight grant write may still finish. The new tab stays `held` and does not autosave over that copy. Agent plan-save may offer a local-save checkbox only when persistence is not `checking` and not `unavailable`, and not already consented. Approving that checkbox during `checking` does not grant or write.

Each `ChoiceStep` carries `origin: 'fixture' | 'custom'`. Explicit `GENERATE_FORECAST` replaces fixture steps as `proposed` and keeps custom steps. Advancing from Context reopens an existing horizon by keeping fixture `status` and `userNote` for matching step IDs, and still keeps custom steps. The Choice editor can add a custom step and can remove only custom-origin steps. Fixture steps have no remove control.

## P2 WebMCP tools and confirmation

P2 adds a static tool catalog behind feature detection. The names do not change when a forecast is missing. Tools return structured failures instead of disappearing.

| Tool | Gate |
| --- | --- |
| `get_session_status` | None. Returns phase, horizon, booleans, persistence kind, intake status, and confirmation status. No profile text, notes, or report wording. |
| `request_profile_access` | Human confirmation of an exact field allowlist. Default is display name, focus, and tone. Belief modules return only when listed and already present. |
| `propose_profile_update` | Human confirmation of the exact diff, including self-supplied belief modules. Birth data is never a field. |
| `get_research_brief` | The same profile-access confirmation. Returns the exact brief, not a reading. |
| `submit_reading_packet` | None for transport. Ops are `begin`, `append_sources`, `append_content`, `finalize`, and `cancel`. Finalize stages a review. It does not adopt. |
| `inspect_reading` | None. Concise coverage, lens, and evidence-id navigation only. |
| `propose_choice_plan` | None. Adds custom steps in `proposed` status. Cannot accept, dismiss, mark resonance, persist, export, or erase. |
| `request_plan_save` | Human confirmation of the plan. Local IndexedDB saving is a separate checkbox and is not implied by plan approval. The checkbox is not offered while persistence is `checking` or `unavailable`. Unavailable storage stays unavailable. |

`ConfirmationState` is one slot. A second gated request while another is pending returns `confirmation_busy`. A gated tool called without a matching approved `confirmationId` returns `needs_confirmation` and never the personal payload. Deny is a first-class result. The pending gate is a native modal dialog. Other page controls stay inert until Approve or Deny. Focus stays on the active control across unrelated parent renders and returns when the confirmation closes.

`AgentAvailability`, `ConfirmationState`, and `ExternalShareState` live on `AppState` and are not written to `StoredSessionV1` or `StoredSessionV2`. Profile reads use an exact field allowlist. Belief modules are returned only when listed and already present. The manual screens stay complete when `document.modelContext` is missing, including structured `ReadingPacketV1` import.

## P3 research contract

P3 adds bounded research as a server-only adapter. The browser bundle must not contain `GEMINI_API_KEY`, an `x-goog-api-key` header, or a module from `server/`. Docs may name the environment variable. They must not include a key value.

```ts
type ResearchMode = 'auto' | 'fixture' | 'manual'

type ResearchProvider = 'gemini' | 'fixture' | 'manual'

type ResearchMethod =
  | 'google_search'
  | 'local_fixture'
  | 'user_supplied_link'

type ResearchOutcomeKind =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'cancelled'
  | 'timed_out'
  | 'error'

interface HorizonCaps {
  maxSources: number
  maxQueries: number
  maxNovelDomains: number
  timeoutMs: number
}

interface EvidenceProvenance {
  provider: ResearchProvider
  method: ResearchMethod
  retrievedAt: string
  query: string
}

interface ResearchSource {
  id: string
  title: string
  url: string | null
  snippet: string
  domain: string | null
  provenance: EvidenceProvenance
}

interface ResearchCoverage {
  sourcesConsidered: number
  sourcesUsed: number
  queriesUsed: number
  novelDomainsUsed: number
  timeWindowDescription: string
  stoppingReason: string
  mode: ResearchProvider
  exhaustive: false
}
```

Horizon caps:

| Horizon | maxSources | maxQueries | maxNovelDomains | timeoutMs |
| --- | --- | --- | --- | --- |
| daily | 6 | 4 | 4 | 20000 |
| weekly | 10 | 6 | 6 | 30000 |
| yearly | 14 | 8 | 8 | 45000 |

`exhaustive` is always `false`. Coverage reports actual counts and a stopping reason. It never claims a complete internet search.

When `GEMINI_API_KEY` is set and live research is enabled with quota prerequisites, auto mode may POST to the official Interactions API with `tools: [{ type: "google_search" }]`. Normalization reads only model text and URL citations. It accepts only `http` and `https` URLs, drops credentials in the userinfo, deduplicates by canonical URL, caps by source and novel domain, and assigns stable hash IDs (`ev_` plus 16 hex characters). Those IDs are not sequential retrieval indexes. Each kept source records provider, method, retrieved time, and query.

Explicit fixture mode uses local fixture evidence with `url: null`. It does not invent live source links. Auto mode does not fall back to fixture when the key, enablement flag, D1 store, hash secret, or trusted identity is missing. Manual mode validates user-supplied links, applies the same caps, and does not fetch or forward page content.

`handleResearchRequest` is a platform-neutral `Request`/`Response` function. POST JSON is the only accepted method. Content-Type must be `application/json`. Invalid input returns `outcome: "error"` with `code: "invalid_input"`. There is no CORS header and no authentication scheme in this slice. AbortSignal cancellation returns `cancelled`. The horizon time budget returns `timed_out`.

The Cloudflare Worker mounts that handler at pathname `/api/research` for every method. Live Gemini is default-off. The Worker may read `GEMINI_API_KEY`, `RESEARCH_ENABLED`, `QUOTA_HASH_SECRET`, `DB`, and `CF-Connecting-IP` from the server environment. It does not hardcode a key and does not change `wrangler.jsonc`. UI confirmation is not that boundary. Every other path continues to the SPA asset handler.

Contrast owns an optional research session. The session is a discriminated union (`idle`, `confirming`, `in_flight`, `complete`). It is not `ConfirmationState`, is not written to `StoredSessionV1`, and is not merged into `ForecastFixture`. The confirm dialog names Gemini Search and shows the exact focus text and selected horizon before any POST. Deny makes zero network requests. Approval POSTs `ResearchRequestInput` with `mode: "auto"` and empty `manualUrls`. Client source must not contain `GEMINI_API_KEY`, `x-goog-api-key`, the Interactions URL, or a `server/` import.

Retrieved text, titles, and snippets are untrusted data. They are never executed, never used as tool policy, and never allowed to raise caps or skip consent.

This slice does not add a share tool. V3-4 does not register `request_external_share`, `generate_forecast`, `inspect_evidence`, or `draft_choice_plan`. Hosted research stays unmounted and is not invoked by WebMCP.

## V2-2 research brief, Gemini protection, and D1 quota

V2-2 adds `ResearchBrief` and `PersonalizedResearchBundle` at schema version 2. The brief contains only `horizon`, `focus`, `tone`, approved cosmic fields, and `requestedLenses`. Display names, birth date/time/place, accounts, raw IP, and arbitrary provider instructions are forbidden. Personalized auto research requires a Sun sign and never infers one. Grounded claims require at least one normalized source ID. Unsupported lenses are listed in `skippedLenses`. Bundle `status` is one of `ready`, `partial`, `unavailable`, `disabled`, `cancelled`, `timed_out`, `quota_exceeded`, `provider_error`, `invalid_provider_output`, and `invalid_input`. `adopted` is always `false` in this package.

Live Gemini requires `RESEARCH_ENABLED` equal to `true`, a server-only key, `QUOTA_HASH_SECRET`, a D1 quota adapter, and a trusted `CF-Connecting-IP` value used only in memory. The adapter allowlists the official Interactions URL, `gemini-2.5-flash`, and `google_search`. It makes at most one provider call after quota reservation. D1 reservation sends visitor and global compare-and-swap statements in one `batch()`. A following insert writes a schema-invalid quota row when `changes()` is 0, so a NOT NULL or CHECK failure rolls that batch back. Sequential CAS plus swallowed decrement is not the correctness mechanism. Cancel or timeout after a successful reservation and before provider I/O calls `release`, a separate bounded batch. If `release` fails, the handler returns unavailable and the slot may remain held. Quota rows contain only `day`, `bucket`, `hash`, and `counter`. Visitor limit is 3 per UTC day. Global limit is 100 per UTC day. Missing prerequisites fail closed and do not become fixture success. Explicit fixture and manual modes remain non-personalized. Agent evidence is kept only when the entry includes a credential-free `http(s)` URL. Missing URLs are not converted into local sources. Adoption, persistence, and WebMCP wiring are out of this package. `db/0001_quota_counters.sql` is inspectable and is not applied. `wrangler.jsonc` is unchanged.

The Contrast V1 `ResearchResult` union is unchanged so the existing research panel can still exhaust outcomes. Auto-mode failures map to `unavailable` on that union. Version-2 bodies return `PersonalizedResearchBundle`.

## P4 synthesis and charts

P4 is a presentation layer over the stored `ForecastFixture`. It does not widen `EvidenceItem` or `StoredSessionV1`.

```ts
type ClaimKind = 'grounded' | 'reflective'

type FrameworkKind = 'interpretive' | 'reflective'

interface EvidenceCardView {
  id: string
  label: string
  sourceType: ForecastSource
  groundedNote: string
  url: string | null
  provider: 'fixture' | 'manual'
  method: 'local_fixture' | 'user_supplied_link'
  retrievedAt: string
  citingTitles: string[]
}

interface HorizonChartModel {
  horizon: HorizonId
  name: string
  title: string
  caption: string
  slots: { id: string; label: string; catalogWeight: number }[]
}
```

`LIVE_RESEARCH_MOUNTED` is `true` when the Worker exposes `/api/research`. That flag does not mean a Gemini credential is present or that a live search succeeded. Fixture cards have `url: null`. The on-page Cosmos and Contrast reading is a legacy, non-personalized fixture path. Copy still says it did not search the internet. It is not V2 personalized research and does not claim live Gemini personalization. Numerology, Human Design, western astrology, Chinese elemental, tarot and oracle, and symbolic codes are interpretive guides, never predictions. Other sections are reflective frameworks. Cosmos and Contrast keep `FREE_WILL_NOTE` visible.

`horizonChart(forecast)` is deterministic. Daily uses four window parts, weekly uses seven days, yearly uses four seasons. Weights are integer catalog counts. The caption states they are not probabilities and not a prediction. Charts render as client-side SVG. There is no Python runtime, no Perplexity dependency, and no SSR requirement.

`generateForecast(profile, horizon)` round-robins used evidence IDs across all eleven sections. Normal output cites every report section with at least one evidence ID from that used fixture pool. Empty `evidenceIds` remains representable for explicit fallback data and focused tests. It is not the normal generated-forecast invariant. Uncertainty stays `unavailable` with no forecast, `partial` when `sourcesUsed` is 0, and `ready` otherwise.

The browser bundle still must not contain `GEMINI_API_KEY`, an `x-goog-api-key` header, or a module from `server/`. Manual screens stay complete when WebMCP is missing.

## P5 hardening

P5 is release-candidate evidence over the P4 app. It does not add tools or collect birth data. The P5 Worker mounted `handleResearchRequest` at POST `/api/research`. V3-1 unmounted that route. `LIVE_RESEARCH_MOUNTED` is `false`. Live Gemini stays off the active product path. Contrast confirmation is not `ConfirmationState` and is not server authentication. Research results are not stored in `StoredSessionV1` or `StoredSessionV2` and are not merged into `ForecastFixture`. A public live Gemini demo is not claimed.

The horizon chart keeps `HorizonChartModel` and adds a visible HTML table of the same slots. Catalog weights stay integers. They are not probabilities. Narrow viewports may hide cramped SVG labels. The table remains.

The shell exposes a skip link to `#main-content`. Report sections keep the T006 uncontrolled disclosure behavior and unique `evidence-${sectionId}-${evidenceId}` heading ids. `FREE_WILL_NOTE` stays on Cosmos and Contrast, including unavailable branches.

WebMCP compatibility is feature detection plus structured tool errors. Unknown names, bad arguments, missing brief or plan, persistence `unavailable`, `confirmation_busy`, and `denied` stay in the `ToolErrorCode` union. V3-4 replaces the legacy catalog names.

Untrusted input, including fixture notes and any later retrieved text, is stored and rendered as data. It cannot widen caps or override consent.

Live WebMCP hosts, ChatGPT Sites, and a verified live Gemini credential remain deferred when not present. The demo path is `docs/DEMO.md`. CI is `.github/workflows/ci.yml` and uses no credentials.

## V3-1 trust, profile, and persistence

V3-1 supersedes the active product path in `src/` and `worker/`. Historical P3–P5 Gemini/D1 text above describes residue under `server/research/` and `db/`. Those files stay on disk. They are not imported by the browser bundle or the Worker.

Active `AppState.profile` is `PersonProfile`: context fields plus nested `beliefs` (`western`, `numerology`, `chinese`, `bazi`, `humanDesign`). Empty module objects are unrepresentable. Forbidden keys include birth date/time/place aliases (`dob`, `datetime`, `fourPillars`), account, cloud, and chart. The app never infers a value from a birth date. Numerology may include a birthday number 1–31. It is not a date.

`ReadingPacketV1` is the untrusted transport. Parse at the edge: https-only URLs, no userinfo credentials, transport caps 10 sources / 3 sections. `ReadingArtifact` is the persistable adopted form (`coverage.mode: 'adopted'`). Legacy `ForecastFixture` stays on `forecastsByHorizon` and cannot satisfy personalization.

Confirmation ids are digest-bound (`c1.` + SHA-256 of canonical JSON of the payload). `adopt_reading` carries `packetDigest` and `horizon`. Adopt writes `readingsByHorizon[packet.horizon]`. Staged packets live on an in-memory `ReadingDesk` with a 30-minute exclusive expiry. Desk, staged packets, tickets, and confirmations are not written to IndexedDB.

Writes use `StoredSessionV3`. `parseStoredSession` migrates V1 → V2 → V3. V1 and V2 parsers stay exported. A V3 document that smuggles `desk`, `staged`, `confirmation`, or `packet` fails parse. `SessionFields` is a persistable Pick and does not include the desk.

`LIVE_RESEARCH_MOUNTED` is `false`. The Worker is assets-only. `src/` and `worker/` must not contain `GEMINI_API_KEY`, `QUOTA_HASH_SECRET`, `D1Database`, `createD1QuotaStore`, or `callGeminiSearch`. Contrast does not POST a Gemini search. A compatible agent can submit a packet for review and adopt. No registered tool shares data or names a Gemini destination.

The on-page Cosmos and Contrast reading remains a legacy, non-personalized fixture path until a packet is adopted. Copy still says it did not search the internet.

## V3-2 research brief, import, and human adoption

V3-2 adds a deterministic coordinator in `src/research/coordinator.ts`. Manual UI and WebMCP tools call it for exact brief generation, `ReadingPacketV1` parse, bounded begin/append/finalize batches, progress, skipped-system reporting, and review state.

`buildExactBrief` returns horizon, focus, tone, projected cosmic fields, the supplied belief modules, requested lenses, and skipped lenses. It returns null without a focus or without at least one belief module. Display names and birth fields are omitted. Two profiles with the same focus produce different briefs when their modules differ.

Cosmos shows the exact brief JSON and a copy-to-agent prompt. Paste import accepts a complete `ReadingPacketV1` JSON object and runs `parseReadingPacketV1`. A valid packet is staged in memory for 30 minutes. It is not written to IndexedDB and is not canonical until the person confirms `adopt_reading`. Deny, cancel, expiry, malformed JSON, unsafe URLs, extra keys, and over-limit batches do not adopt. Prompt-injection-like text is held as untrusted data and cannot change caps or consent.

Contrast shows coverage, supported and skipped systems, and Adopt. Approve in the agent bar writes `readingsByHorizon`. `SessionFields` still omits `desk` and `intake`.

## V3-3 studio

V3-3 puts an adopted `ReadingArtifact` and a labeled fixture on the same five-stage page. `studioView(state)` in `src/domain/studioView.ts` is the only page-facing derivation. Phases receive `StudioPhaseProps`. They do not receive `AppState`. They do not import `ForecastFixture` or `ReadingArtifact`.

```ts
type StudioReading =
  | { status: 'empty'; emptyTitle: string; emptyBody: string }
  | {
      status: 'ready'
      lede: string
      legacyBadge: 'legacy' | null
      digestLine: string | null
      coverage: StudioCoverage
      sections: StudioSection[]
      evidence: StudioEvidenceCard[]
      skippedLenses: SkippedLensCopy[]
      charts: ChartModel[]
    }

interface ChartSlot {
  id: string
  label: string
  value: number
}

type SetResonanceAction = {
  type: 'SET_RESONANCE'
  sectionId: ReportSectionId
  mark: ResonanceMark
}
```

Adopted artifacts win when `readingsByHorizon[horizon]` is set, even if the fixture slot is null. `canAdvance` for cosmos and contrast uses that same readable-corpus rule. Fixture-only loops still work. The ready fixture view sets `legacyBadge: 'legacy'`. Adopted cards copy the packet https URL and leave `retrievedAt` null. Fixture cards keep `url: null`. Coverage `exhaustive` is the literal `false`.

Charts are `ChartModel` with integer `value` slots, drawn by `ChartFigure` as SVG plus a table. Adopted packets do not reuse fixture window slots. A BaZi element chart appears only when `elementCounts` has present keys. `SET_RESONANCE` no-ops on hidden ids and on repeat marks. `ToolAction` excludes it. Hidden resonance keys stay in `AppState`. Adopt does not prune them. `StoredSessionV3` is unchanged. Advancing into Choice with no plan seeds an empty `ChoicePlanDraft` so a custom step can be accepted.

`PersistenceBar` owns autosave. It watches phase, horizon, profile, forecasts, plans, readings, and resonance. It does not watch `persistence.kind` saved or saving. `src/styles.css` holds the studio grid, serif reading type, sans controls, and 120 / 180 / 280 ms transform and opacity motion. Theme follows `prefers-color-scheme` only. Continuity may show adopted receipt copy. Print and calendar download exist only for an adopted `ReadingArtifact`. Calendar events are accepted steps only, with person-selected date, time, and timezone, capped Daily 3 / Weekly 7 / Yearly 4. Fixture-only sessions stay export-less.

## V3-4 WebMCP parity

V3-4 replaces the legacy catalog with eight agent-native tools over the shared coordinator and existing digest-bound confirmation slot:

`get_session_status`, `request_profile_access`, `propose_profile_update`, `get_research_brief`, `submit_reading_packet`, `inspect_reading`, `propose_choice_plan`, `request_plan_save`.

`generate_forecast`, `inspect_evidence`, `draft_choice_plan`, and `request_external_share` are not registered. Packet ops are `begin`, `append_sources`, `append_content`, `finalize`, and `cancel`. `append_content` maps to the coordinator's `append_sections`. Finalize stages a review. It does not adopt. Profile reads use an exact allowlist. Brief access uses the same `personal_data_access` confirmation with the fields the brief will expose. `inspect_reading` returns coverage, lens ids, and evidence titles only. `propose_choice_plan` adds custom steps in `proposed` status. `ToolAction` cannot approve, deny, generate a fixture, set step status, mark resonance, adopt, or erase. Missing `document.modelContext` is an honest unavailable state with manual import as the fallback.
