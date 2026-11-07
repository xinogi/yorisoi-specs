/**
 * Done criterion 4 — pinching a highlighted word on the foreign page makes her answer, the
 * translation card appears right next to that word, then fades (~8 s).
 *
 * Parameters: word = "bara" (any PAGE_WORDS id); holdSeconds = "8" (expected card time).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, f1, Lens, log, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {findLine, findWord} from "../Scripts/DeskCompanionContent"

@component
export class DC4WordTranslationScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const wordId = (config && config.get("word")) || "bara"
    const holdS = (config && config.getNumber("holdSeconds")) || 8
    const checks = new CheckList("DC4")
    const lens = new Lens()
    const word = findWord(wordId)
    expect(!!word, `unknown word id ${wordId}`).toBe(true)
    const buttonName = "Word_" + wordId
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    expect(await waitUntil(() => !!findInteractableByName(buttonName, undefined, true), 5000), `${buttonName} interactable never appeared`).toBe(true)
    await sleep(500)
    checks.check("no card before the pinch", lens.page.shownTranslationWordId === "", `shownTranslationWordId="${lens.page.shownTranslationWordId}"`)

    const interactor = new DeskCompanionLeafInteractor()
    const tPinch = getTime()
    await interactor.tap(buttonName)
    await sleep(300)

    checks.check(`card shows ${wordId}`, lens.page.shownTranslationWordId === wordId, `shownTranslationWordId="${lens.page.shownTranslationWordId}"`)
    const lineId = word!.lineId
    checks.check(`she answers (${lineId})`, lens.voice.lastLineId === lineId, `lastLineId=${lens.voice.lastLineId}`)
    const line = findLine(lineId)
    checks.check(
      "her subtitle is the word's explanation",
      lens.bubble.isShown && !!line && lens.bubble.currentJa === line.ja,
      `isShown=${lens.bubble.isShown} ja="${lens.bubble.currentJa}"`
    )

    // the card sits right next to the pinched word
    const card = findSceneObjectByName("TranslationCard")
    const wordSO = findSceneObjectByName(buttonName)
    if (card && wordSO) {
      const gap = card.getTransform().getWorldPosition().distance(wordSO.getTransform().getWorldPosition())
      checks.check("card visible", card.enabled && card.isEnabledInHierarchy, `card.enabled=${card.enabled}`)
      checks.check("card right next to the word", gap <= 15, `card-to-word ${f1(gap)} cm`)
    } else {
      checks.check("card / word objects found", false, `TranslationCard=${!!card} ${buttonName}=${!!wordSO}`)
    }

    // fades after ~holdS seconds
    const faded = await waitUntil(() => lens.page.shownTranslationWordId === "", (holdS + 3) * 1000)
    const fadeS = getTime() - tPinch
    checks.check(
      `card fades after ~${holdS} s`,
      faded && fadeS >= holdS - 1 && fadeS <= holdS + 1.5,
      `cleared ${f1(fadeS)} s after the pinch (expected ${holdS} s)`
    )
    await sleep(500)
    if (card) checks.check("card hidden after the fade", !card.enabled, `card.enabled=${card.enabled}`)
    log(`DC4 end :: ${lens.summary()}`)
    checks.finish()
  }
}
