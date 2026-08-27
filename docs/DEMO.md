# Demo walkthrough

This is the P5 manual-plus-agent path for Choice & Cosmos. Follow it in a local browser after `npm run dev`. Expected states below are exact UI copy or roles. Native Chrome WebMCP is verified locally when Chrome exposes `document.modelContext.registerTool`. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred. Gemini Search on Contrast is optional. This walk does not require a live credential.

## Setup

1. From the repo root, run `npm install` once, then `npm run dev`.
2. Open the printed local URL. Use native Chrome to exercise the verified WebMCP path. A browser without `document.modelContext.registerTool` still follows the missing-API fallback.
3. The Worker does not forward `GEMINI_API_KEY`. The screens use fixture evidence.

## Manual loop

| Step | Action | Expected state |
| --- | --- | --- |
| 1 | Land on the app | Heading `Context`. If this browser does not expose `document.modelContext.registerTool`, the agent bar says this browser does not expose `document.modelContext.registerTool` and the loop still works by hand. If native Chrome WebMCP is present, the agent bar says `Agent tools are available in this browser. Personal details, external sharing, and plan saving still need your confirmation on this page.` |
| 2 | Choose Weekly | Radio `weekly` is selected. Cockpit name later reads `Compass`. |
| 3 | Type a focus | Field `What's on your mind right now?` contains your words. `Open the cosmos` enables. |
| 4 | Open Cosmos | Heading `Cosmos`. Free-will note is visible. Copy says this reading uses local fixture or manual examples and did not search the internet. A `Compass window map` image and a catalog-weight table are visible. `Grounded source notes` and `Reflective interpretation` appear. Eleven report sections are listed. |
| 5 | Open Contrast | Heading `Contrast`. Uncertainty kind `ready`. Provenance method `local_fixture`. No invented live URL on fixture cards. Optional Gemini Search is present and has not run. |
| 5a | Optional research, deny | Click `Search with Gemini`. Dialog heading `Confirm Gemini Search` names Gemini Search, the typed focus, and `Compass (weekly)`. Click `Don't search`. No network request. Fixture Contrast is unchanged. |
| 5b | Optional research, Worker fallback | Click `Search with Gemini`, then `Search with Gemini` in the dialog. The Worker does not forward a Gemini key. The page must say no live search occurred or show fixture fallback evidence. It must not claim a live Gemini success. |
| 6 | Open Choice | Heading `Choice`. Three fixture steps are present. None is pre-selected as required. |
| 7 | Open Continuity | Heading `Continuity`. Session receipt is on the page. Saving remains optional. |

Daily and yearly use the same steps. Swap the horizon radio. Expected chart titles are `Signal window map` and `Constellation window map`.

Keyboard. Tab to `Skip to the loop`, then into the first report `summary`. Enter toggles disclosure. Disclosure stays put after a later tab.

## Agent path when WebMCP is missing

The catalog is still eight tools. Feature detection leaves tools unregistered. Use the screens by hand. That is the supported fallback, not a broken page.

## Agent path when WebMCP is present

Native Chrome WebMCP is verified locally. The agent bar says `Agent tools are available in this browser. Personal details, external sharing, and plan saving still need your confirmation on this page.` The same eight names register. Profile read, profile update, plan save, and external share still require on-page `Approve`. Deny is honored. `request_external_share` still records `approved_not_sent` and does not send data. Contrast Gemini Search is a separate human confirmation. It is not that tool. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred.

## Honest limits

- No birth date, birth time, or birth location field.
- Chart weights are integer catalog counts, not probabilities.
- Nothing here is medical, financial, or predictive advice.
- Retrieved or fixture text is data. It is never executed.
- Server secrets stay out of the client bundle.
- The Worker does not forward a Gemini key. Fixture or manual fallback is the mounted path.
- Public Gemini mounting remains unverified.
- Live ChatGPT Sites WebMCP discovery remains unverified.
- Public deployment remains deferred.
