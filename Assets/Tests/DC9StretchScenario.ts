/**
 * DC9 — Stretch break: Call her over, pinch Stretch -> intro line, then the 4 moves in order
 * (arms up, side, shoulders, neck) each with its line, the card showing the move name and a
 * 1–2–3–4 count, then "Great job! Feel better?" (stretch_done). A second run is cancelled by
 * pressing another button (Call). The routine clock is sped up (parameter timeScale "3").
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, Lens, log, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionStretch, STRETCH_MOVES} from "../Scripts/DeskCompanionStretch"
import {DeskCompanionStretchCardUI} from "../Scripts/DeskCompanionStretchCardUI"

@component
export class DC9StretchScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const timeScale = (config && config.getNumber("timeScale")) || 3
    const checks = new CheckList("DC9")
    const lens = new Lens()
    const c = lens.controller
    const stretch = requireComponent<DeskCompanionStretch>("Stretch", DeskCompanionStretch.getTypeName())
    const card = requireComponent<DeskCompanionStretchCardUI>("StretchCard", DeskCompanionStretchCardUI.getTypeName())
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    expect(await waitUntil(() => !!findInteractableByName("CallButton", undefined, true), 5000), "CallButton interactable never appeared").toBe(true)
    await sleep(500)
    const lines: string[] = []
    const onLine = (id: string) => lines.push(id)
    lens.voice.onLineSpoken.add(onLine)
    const interactor = new DeskCompanionLeafInteractor()
    try {
      await interactor.tap("CallButton")
      expect(await waitUntil(() => c.state === "attend", 6000), "she never came over after Call").toBe(true)
      expect(await waitUntil(() => !!findInteractableByName("StretchButton", undefined, true), 3000), "StretchButton never appeared").toBe(true)
      await sleep(300)
      stretch.timeScale = timeScale
      await interactor.tap("StretchButton")
      await sleep(150)
      checks.check("Stretch starts with the intro line", stretch.stretchActive && stretch.stretchStep === -1 && lens.voice.lastLineId === "stretch_intro", `active=${stretch.stretchActive} step=${stretch.stretchStep} line=${lens.voice.lastLineId}`)

      const seenSteps: number[] = []
      let cardOk = true
      const anims: string[] = []
      let countOk = false
      const deadline = getTime() + 60
      while (stretch.stretchActive && getTime() < deadline) {
        const st = stretch.stretchStep
        if (st >= 0 && seenSteps.indexOf(st) < 0) {
          seenSteps.push(st)
          await sleep(100)
          if (card.currentEn !== STRETCH_MOVES[st].en) cardOk = false
          anims.push(lens.animator.currentAnim)
        }
        if (stretch.stretchCount >= 2) countOk = true
        await sleep(50)
      }
      checks.check("4 moves in order", seenSteps.join(",") === "0,1,2,3", `steps=${seenSteps.join(",")}`)
      const moveLines = STRETCH_MOVES.map((m) => m.lineId)
      checks.check("each move says its line", moveLines.every((id) => lines.indexOf(id) >= 0), `lines=${lines.join(",")}`)
      checks.check("card shows each move name", cardOk, `last card="${card.currentEn}"`)
      checks.check("each move plays its stretch clip", anims.join(",") === STRETCH_MOVES.map((m) => m.anim).join(","), `anims=${anims.join(",")} strategy=${lens.animator.strategy}`)
      checks.check("1–2–3–4 count runs", countOk, `count reached ${stretch.stretchCount}`)
      checks.check("ends with stretch_done", !stretch.stretchActive && lens.voice.lastLineId === "stretch_done" && !card.isShown, `active=${stretch.stretchActive} line=${lens.voice.lastLineId} card=${card.isShown}`)

      // any other button cancels a running routine
      await sleep(500)
      if (!findInteractableByName("StretchButton", undefined, true)) {
        await interactor.tap("CallButton")
        await waitUntil(() => !!findInteractableByName("StretchButton", undefined, true), 4000)
      }
      await interactor.tap("StretchButton")
      await sleep(300)
      await interactor.tap("CallButton") // she steps back for the stretch, so use the desk button
      await sleep(150)
      checks.check("another button cancels the routine", !stretch.stretchActive && !card.isShown, `active=${stretch.stretchActive} card=${card.isShown}`)
      log(`DC9 lines: ${lines.join(",")}`)
    } finally {
      stretch.timeScale = 1
      lens.voice.onLineSpoken.remove(onLine)
    }
    checks.finish()
  }
}
