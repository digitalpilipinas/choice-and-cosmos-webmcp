# Choice & Cosmos: P0, P1, and P2 specification

This file describes the data model and constraints for the P0 foundation, the fixture preview, the P1 local persistence and choice-plan editor, the P2 WebMCP tool layer, and the P3 server-only research adapter. It is the reference for what the code in `src/domain/`, `src/fixtures/`, `src/persistence/`, `src/webmcp/`, `src/research/`, and `server/research/` must stay true to as later phases build on it.

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

interface DerivedProfile {
  displayName: string;
  focusIntention: string;
  tone: 'grounded' | 'curious' | 'bold';
}

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
  | { kind: 'profile_update'; proposed: Partial<DerivedProfile> }
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

`DerivedProfile` never carries a birth date, birth time, or birth location. That stays true in every later phase, not only P0.

`ForecastCockpit` and `UncertaintyState` are derived view models. They are not stored on `ForecastFixture` or `StoredSessionV1`. `forecastCockpit(horizon, profile, forecast)` takes `name` from `HORIZON_BY_ID[horizon].label` only. `uncertaintyFor(forecast)` is `unavailable` when the forecast is missing, `ready` when `coverage.sourcesUsed` is above zero, and `partial` otherwise. Source comes from `coverage.mode`. Limitations copy says the run used fixture or manual data, not live research, and must not read as a confidence score.

`evidenceForSection(forecast, section)` and `sectionsCitingEvidence(forecast, evidenceId)` map existing `ReportSection.evidenceIds` onto `EvidenceItem.id` in both directions. They do not add stored fields.

`generateForecast(profile, horizon)` is a pure, deterministic function. The same focus text, tone, and horizon always produce the same fixture forecast, seeded by a plain string hash rather than by wall-clock time or `Math.random()`. This is a fixture generator, not a research pipeline. P1 still writes `coverage.mode` as `'fixture'`. P3 adds a separate server-side research contract behind `src/research/` and `server/research/`. P4 keeps that on-page forecast and cites every report section from the used fixture pool. Fixture and manual research fallback stay alive rather than deleted. Live research remains unmounted.

## Non-negotiable constraints

These carry forward from the project's implementation plan and apply to every phase, not only P0.

- Astrology, Human Design, numerology, tarot and oracle, personality, and elemental systems are always labeled as interpretive or reflective frameworks, never as objective certainty.
- No lottery probabilities, no fake precision percentages, no deterministic predictions, no medical diagnosis or treatment, no financial advice.
- No raw birth date, birth time, or birth location by default, or in P0, at all. A later phase that adds optional personal-data access must make that access explicit and confirmed, never silent.
- Personal profile access, profile changes, external sharing, and choice-plan saving all require clear, scoped, revocable confirmation once those features exist. P0 has none of them yet: everything lives in memory for the current session only. P1 adds consent-gated local saving of the session in this browser only. It is still explicit, informed, and revocable. There is still no account and no cloud copy.
- API secrets, once a phase introduces them, stay server-side. Never in a client bundle, a log, a screenshot, a fixture, or a commit.
- Web pages, search results, retrieved documents, and agent arguments are untrusted input once real research exists. Source text never overrides tool policy or a consent boundary.
- Research is bounded by horizon-specific time, source, and novelty limits. The app reports actual coverage and its stopping reason instead of claiming exhaustive internet knowledge, even in fixture mode.
- The UI keeps working by hand when WebMCP is unavailable. P2 feature-detects `document.modelContext.registerTool` and registers a static catalog when it exists. Missing support is an honest unavailable state, not a broken page.
- Charts and forecast data are deterministic and computed client-side. No Python runtime, no Perplexity dependency, no server-side rendering requirement.
- The MVP stays local-first: no account system, no cloud profile sync, no Supabase, D1, or R2, unless a later approved plan change says otherwise.

## What P0 explicitly does not build

WebMCP tool registration, Gemini or any other network-backed research, IndexedDB or any other persistence, account or cloud sync, external sharing, raw birth-data collection, and anything that reads as a prediction rather than a reflection. These are scoped to P1 through P5 in the project's GoalBuddy board (`docs/goals/choice-and-cosmos-webmcp/`), which this slice does not touch.

## P1 persistence and choice editor

P1 adds a local session copy and a way to add or remove personal choice-plan steps. It does not add WebMCP, Gemini, raw birth data, an account, or cloud sync.

Saving uses IndexedDB in this browser profile only. Bootstrap never starts a save on its own. The first write happens after the person grants consent. Decline is remembered so the prompt stays quiet, and a later grant is still allowed. Clear erases the stored session and the consent flag. Nothing is described as synced, shared, backed up, or durable beyond this profile.

`PersistenceStatus` is the live consent and save state. `StoredSessionV1` is the document written after consent. `held` means a stored copy exists and this tab is not using it, so that copy was not loaded. `error.operation` is `'save'`, `'decline'`, or `'erase'`. `hasPersistenceConsent` is true for `saving`, `saved`, and `error` except when `operation` is `'decline'`. It is false for `checking`, `unavailable`, `undecided`, `held`, and `declined`. Autosave runs only while consent is true, and it also stays off after an erase failure so the erase control remains. A late `PERSISTENCE_HELD` does not replace `saving`, `saved`, or a save `error`. `RESTART` from `saving`, `saved`, or a save `error` moves persistence to `held` so autosave does not replace the stored session. Late `PERSISTENCE_SAVE_START`, `PERSISTENCE_SAVE_SUCCESS`, and save-operation `PERSISTENCE_SAVE_ERROR` do not replace `held`. An in-flight grant write may still finish. The new tab stays `held` and does not autosave over that copy. Agent plan-save may offer a local-save checkbox only when persistence is not `checking` and not `unavailable`, and not already consented. Approving that checkbox during `checking` does not grant or write.

Each `ChoiceStep` carries `origin: 'fixture' | 'custom'`. Explicit `GENERATE_FORECAST` replaces fixture steps as `proposed` and keeps custom steps. Advancing from Context reopens an existing horizon by keeping fixture `status` and `userNote` for matching step IDs, and still keeps custom steps. The Choice editor can add a custom step and can remove only custom-origin steps. Fixture steps have no remove control.

## P2 WebMCP tools and confirmation

P2 adds a static tool catalog behind feature detection. The names do not change when a forecast is missing. Tools return structured failures instead of disappearing.

| Tool | Gate |
| --- | --- |
| `get_session_status` | None. Returns phase, horizon, booleans, persistence kind, and confirmation status. No profile text, notes, or plan wording. |
| `request_profile_access` | Human confirmation. Personal fields return only after approve. |
| `propose_profile_update` | Human confirmation of the exact diff. The pre-approval agent result names only the fields. After approval the agent result contains only the approved fields. Existing values appear only in the on-page gate. Birth data is never a field. |
| `generate_forecast` | Focus intention must already exist. Uses regenerate semantics. |
| `inspect_evidence` | None. Fixture evidence, coverage, and uncertainty only. No focus text or notes. |
| `draft_choice_plan` | None. Mutates the in-memory plan. Does not save. |
| `request_plan_save` | Human confirmation of the plan. Local IndexedDB saving is a separate checkbox and is not implied by plan approval. The checkbox is not offered while persistence is `checking` or `unavailable`. Unavailable storage stays unavailable. |
| `request_external_share` | Human confirmation. Approval is recorded as `approved_not_sent`. Nothing is sent. The P3 research handler is a separate server entry and is not invoked by this tool. |

`ConfirmationState` is one slot. A second gated request while another is pending returns `confirmation_busy`. A gated tool called without a matching approved `confirmationId` returns `needs_confirmation` and never the personal payload. Deny is a first-class result. The pending gate is a native modal dialog. Other page controls stay inert until Approve or Deny. Focus stays on the active control across unrelated parent renders and returns when the confirmation closes.

`AgentAvailability`, `ConfirmationState`, and `ExternalShareState` live on `AppState` and are not written to `StoredSessionV1`. The manual screens stay complete when `document.modelContext` is missing.

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
| daily | 4 | 3 | 3 | 12000 |
| weekly | 5 | 4 | 4 | 15000 |
| yearly | 6 | 4 | 5 | 18000 |

`exhaustive` is always `false`. Coverage reports actual counts and a stopping reason. It never claims a complete internet search.

When `GEMINI_API_KEY` is set, auto mode may POST to the official Interactions API with `tools: [{ type: "google_search" }]`. Normalization reads only model text and URL citations. It accepts only `http` and `https` URLs, drops credentials in the userinfo, deduplicates by canonical URL, caps by source and novel domain, and assigns stable hash IDs (`ev_` plus 16 hex characters). Those IDs are not sequential retrieval indexes. Each kept source records provider, method, retrieved time, and query.

When the key is missing, auto mode uses local fixture evidence with `url: null`. It does not invent live source links. Explicit fixture mode does the same even if a key exists. Manual mode validates user-supplied links, applies the same caps, and does not fetch or forward page content.

`handleResearchRequest` is a platform-neutral `Request`/`Response` function. POST JSON is the only accepted method. Invalid input returns `outcome: "error"` with `code: "invalid_input"`. There is no CORS header and no authentication scheme in this slice. AbortSignal cancellation returns `cancelled`. The horizon time budget returns `timed_out`.

Retrieved text, titles, and snippets are untrusted data. They are never executed, never used as tool policy, and never allowed to raise caps or skip consent.

This slice does not change the P2 tool catalog. P4 adds on-page synthesis and charts without importing `server/` or mounting the research handler.

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

`LIVE_RESEARCH_MOUNTED` is `false`. Fixture cards have `url: null`. The UI never fabricates an `https` link. Numerology, Human Design, western astrology, Chinese elemental, tarot and oracle, and symbolic codes are interpretive guides, never predictions. Other sections are reflective frameworks. Cosmos and Contrast keep `FREE_WILL_NOTE` visible.

`horizonChart(forecast)` is deterministic. Daily uses four window parts, weekly uses seven days, yearly uses four seasons. Weights are integer catalog counts. The caption states they are not probabilities and not a prediction. Charts render as client-side SVG. There is no Python runtime, no Perplexity dependency, and no SSR requirement.

`generateForecast` round-robins used evidence IDs across all eleven sections. Empty cites remain representable for fallback and tests. Uncertainty stays `unavailable` with no forecast, `partial` when `sourcesUsed` is 0, and `ready` otherwise.

The browser bundle still must not contain `GEMINI_API_KEY`, an `x-goog-api-key` header, or a module from `server/`. Manual screens stay complete when WebMCP is missing.

## P5 hardening

P5 is release-candidate evidence over the P4 app. It does not add tools, mount live research, or collect birth data.

The horizon chart keeps `HorizonChartModel` and adds a visible HTML table of the same slots. Catalog weights stay integers. They are not probabilities. Narrow viewports may hide cramped SVG labels. The table remains.

The shell exposes a skip link to `#main-content`. Report sections keep the T006 uncontrolled disclosure behavior and unique `evidence-${sectionId}-${evidenceId}` heading ids. `FREE_WILL_NOTE` stays on Cosmos and Contrast, including unavailable branches.

WebMCP compatibility is feature detection plus structured tool errors. Unknown names, bad arguments, missing forecast or plan, persistence `unavailable`, `confirmation_busy`, and `denied` stay in the existing `ToolErrorCode` union. The eight-tool catalog does not change.

Untrusted input, including fixture notes and any later retrieved text, is stored and rendered as data. It cannot widen caps or override consent.

Live WebMCP hosts, ChatGPT Sites, and Gemini UI mounting are deferred when not verified. The demo path is `docs/DEMO.md`. CI is `.github/workflows/ci.yml` and uses no credentials.
