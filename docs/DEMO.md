# Demo walkthrough

This is the P5 manual-plus-agent path for Choice & Cosmos, updated for V3-1 trust, V3-2 packet adoption, the V3-3 studio, and the V3-4 agent-native catalog. Follow it in a local browser after `npm run dev`. Expected states below are exact UI copy or roles. Native Chrome WebMCP is verified locally when Chrome exposes `document.modelContext.registerTool`. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred. Hosted research is not mounted. This walk does not require a live credential.

## Setup

1. From the repo root, run `npm install` once, then `npm run dev`.
2. Open the printed local URL. Use native Chrome to exercise the verified WebMCP path. A browser without `document.modelContext.registerTool` still follows the missing-API fallback.
3. The Worker serves assets only. The screens use fixture evidence until you adopt a packet.

## Manual loop

| Step | Action | Expected state |
| --- | --- | --- |
| 1 | Land on the app | Heading `Context`. If this browser does not expose `document.modelContext.registerTool`, the agent bar says this browser does not expose `document.modelContext.registerTool` and the loop still works by hand. If native Chrome WebMCP is present, the agent bar says `Agent tools are available in this browser. Profile access, research briefs, packet adoption, and plan saving still need your confirmation on this page. An agent cannot approve itself.` |
| 2 | Choose Weekly | Radio `weekly` is selected. Cockpit name later reads `Compass`. |
| 3 | Type a focus and select one belief-system lens value | Field `What's on your mind right now?` contains your words. One lens is checked and has a closed-enum value, for example Western Sun `Leo`. Tone may stay at its default. `Open the cosmos` enables only after both the focus and that lens value are present. |
| 4 | Open Cosmos | Heading `Cosmos`. Free-will note is visible. A `legacy` badge is visible on the fixture path. Copy says this reading uses local fixture or manual examples and did not search the internet. A `Compass window map` image and an integer-count table are visible. `Grounded source notes` and `Reflective interpretation` appear. Eleven fixture report sections are listed. `Research brief` shows the exact JSON and a copy-to-agent prompt. Paste a `ReadingPacketV1` JSON object and choose `Review pasted packet` to stage it. It is not adopted yet. |
| 5 | Open Contrast | Heading `Contrast`. Uncertainty kind `ready`. Provenance method `local_fixture`. No invented live URL on fixture cards. Copy says this page does not search the internet. Coverage is not exhaustive. There is no Gemini Search button. If a packet is staged, Contrast shows validation review, supported and skipped systems, and `Adopt this packet`. Approve in the agent bar writes the canonical reading. Deny, cancel, expiry, malformed JSON, and over-limit batches do not. An adopted weekly packet with no weekly fixture still opens this page and shows those packet sections plus skipped-lens copy. |
| 6 | Open Choice | Heading `Choice`. Fixture steps are present on the fixture path. None is pre-selected as required. Visible sections have Resonates, Not for me, and Unsure. Those marks are not a WebMCP tool. If local saving is already on, a Resonates click is stored with the session. |
| 7 | Open Continuity | Heading `Continuity`. Session receipt is on the page. Adopted sessions show the digest. After adopt, `Print this reading` is present. After at least one accepted step, `Download calendar` is present with a preview table. A fixture-only session has neither control. Saving remains optional. |

Daily and yearly use the same steps. Swap the horizon radio. Expected fixture chart titles are `Signal window map` and `Constellation window map`. An adopted packet uses a citation map instead of those window slots.

Keyboard. Tab to `Skip to the loop`, then into the first report `summary`. Enter toggles disclosure. Disclosure stays put after a later tab.

## Agent path when WebMCP is missing

The catalog is still eight tools. Feature detection leaves tools unregistered. Use the screens by hand, including structured `ReadingPacketV1` import. That is the supported fallback, not a broken page.

## Agent path when WebMCP is present

Native Chrome WebMCP is verified locally. The agent bar says profile access, research briefs, packet adoption, and plan saving still need on-page confirmation, and that an agent cannot approve itself. The eight V3 names register. Profile read, research brief, profile update, packet adoption, and plan save still require on-page `Approve`. Deny is honored. Packet submit stages a review and does not adopt. Live ChatGPT Sites WebMCP discovery remains unverified. Public deployment remains deferred.

## Honest limits

- No birth date, birth time, or birth location field.
- Chart values are integer counts, not probabilities.
- An adopted packet is a reviewed submission. It is not an exhaustive search.
- Nothing here is medical, financial, or predictive advice.
- Retrieved or fixture text is data. It is never executed.
- Server secrets stay out of the client bundle.
- The Worker does not run hosted research. Fixture evidence is the on-page path until a packet is adopted.
- Continuity print and calendar download require an adopted reading. A fixture-only session has neither control. Calendar files contain accepted steps only.
- Live ChatGPT Sites WebMCP discovery remains unverified.
- Public deployment remains deferred.
