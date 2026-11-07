/**
 * DC7 — poking her: tickle -> annoyed -> forgive (persona/modes.md "しつこく触られた時").
 *
 * 1. One pinch on her (SceneObject "CompanionTouch"): "Hey, that tickles!" (poke_tickle), mood tickled.
 * 2. Pokes in quick succession: at `annoyedAfterPokes` (4) she gets annoyed — "Okay, that's
 *    enough. Hands off!" (poke_annoyed) and the pout clip (or its stand-in).
 * 3. While annoyed, more pokes are ignored.
 * 4. A few seconds later she forgives you: "Hmph... fine. I forgive you." (poke_forgive), then
 *    back to normal.
 * 5. No conflict: the Call button still works right after.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, Lens, log, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionTouch} from "../Scripts/DeskCompanionTouch"

@component
export class DC7PokeMoodScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const checks = new CheckList("DC7")
    const lens = new Lens()
    const c = lens.controller
    const touch = requireComponent<DeskCompanionTouch>("CompanionTouch", DeskCompanionTouch.getTypeName())
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    expect(await waitUntil(() => !!findInteractableByName("CompanionTouch", undefined, true), 5000), "CompanionTouch interactable never appeared").toBe(true)
    // start from a calm state (an earlier poke may still be in the window)
    await waitUntil(() => touch.moodState === "normal" && touch.pokeCount === 0, 9000)
    await sleep(300)

    const lines: string[] = []
    const onLine = (id: string) => lines.push(id)
    lens.voice.onLineSpoken.add(onLine)
    const interactor = new DeskCompanionLeafInteractor()
    try {
      // ── 1. one poke ──
      await interactor.tap("CompanionTouch")
      await sleep(150)
      checks.check("one poke -> poke_tickle, mood tickled", lens.voice.lastLineId === "poke_tickle" && touch.moodState === "tickled" && touch.pokeCount === 1, `line=${lens.voice.lastLineId} mood=${touch.moodState} pokes=${touch.pokeCount}`)

      // ── 2. quick pokes -> annoyed ──
      for (let i = 0; i < touch.annoyedAfterPokes - 1; i++) {
        await sleep(350)
        await interactor.tap("CompanionTouch")
      }
      await sleep(200)
      checks.check("repeated pokes -> annoyed + poke_annoyed", touch.moodState === "annoyed" && lens.voice.lastLineId === "poke_annoyed", `mood=${touch.moodState} line=${lens.voice.lastLineId} pokes=${touch.pokeCount}`)
      const anim = lens.animator.currentAnim
      checks.check("pout clip (or its stand-in) plays", ["pout", "scold", "surprised"].indexOf(anim) >= 0, `currentAnim=${anim}`)

      // ── 3. ignored while annoyed ──
      const before = touch.pokeCount
      await sleep(300)
      await interactor.tap("CompanionTouch")
      await sleep(150)
      checks.check("pokes ignored while annoyed", touch.pokeCount === before && touch.moodState === "annoyed", `pokes ${before} -> ${touch.pokeCount} mood=${touch.moodState}`)

      // ── 4. forgives ──
      const forgave = await waitUntil(() => lines.indexOf("poke_forgive") >= 0, (touch.ignoreSeconds + 3) * 1000)
      checks.check("a little later -> poke_forgive", forgave && touch.moodState === "forgiving", `mood=${touch.moodState} lines=${lines.join(",")}`)
      const calm = await waitUntil(() => touch.moodState === "normal", 6000)
      checks.check("back to normal", calm, `mood=${touch.moodState}`)

      // ── 5. Call still works ──
      await interactor.tap("CallButton")
      await sleep(150)
      checks.check("Call still works after pokes", lens.voice.lastLineId === c.callLineId, `line=${lens.voice.lastLineId} expected=${c.callLineId}`)
      log(`DC7 lines: ${lines.join(",")}`)
    } finally {
      lens.voice.onLineSpoken.remove(onLine)
    }
    checks.finish()
  }
}
