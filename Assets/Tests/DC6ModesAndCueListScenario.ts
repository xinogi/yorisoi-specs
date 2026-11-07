/**
 * DC6 — Mode cycling + the cue-card talk list.
 *
 * 1. Call her over, then pinch Mode until Cue cards: every press moves to the next mode in
 *    persona/modes.md order, she says that mode's call line and the bubble badge reads
 *    "Yori · <Name> mode · <名前>モード".
 * 2. Cue cards: she steps back to her spot and the whole talk list shows beside her (one row per
 *    item, the first item highlighted with its delivery note, total timer in the header).
 * 3. Time bar: the current item's clock runs and the bar text updates.
 * 4. Next / Back move the highlight (Next says cue_next).
 * 5. Coaching: an item running past 130 % of its time -> cue_slow_down.
 * 6. Auto (toggle): the list moves on by itself; 60 s before the planned end -> cue_one_minute;
 *    last item -> cue_done and Auto switches off.
 * 7. Rehearse: runs the deck from the top in Auto and ends with cue_rehearsal_done, the measured
 *    total in the subtitle.
 * 8. Decks + edits: Deck ▶ switches deck, pinching a row jumps to it, +5s / −5s change the current
 *    item's time (total updates), ▲ moves the current item up.
 * The talk-list clock is sped up (cueTimeScale, parameter timeScale "20") so the run stays short;
 * everything is put back (time scale 1, start mode) at the end.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, f1, Lens, log, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionModeController} from "../Scripts/DeskCompanionModeController"
import {DeskCompanionCueCardsUI} from "../Scripts/DeskCompanionCueCardsUI"
import {PERSONA_MODES} from "../Scripts/DeskCompanionPersonaData"
import {lineIdForMode} from "../Scripts/DeskCompanionContent"

@component
export class DC6ModesAndCueListScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const timeScale = (config && config.getNumber("timeScale")) || 20
    const checks = new CheckList("DC6")
    const lens = new Lens()
    const c = lens.controller
    const modes = requireComponent<DeskCompanionModeController>("CompanionModes", DeskCompanionModeController.getTypeName())
    const list = requireComponent<DeskCompanionCueCardsUI>("CueCards", DeskCompanionCueCardsUI.getTypeName())
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    expect(await waitUntil(() => !!findInteractableByName("CallButton", undefined, true), 5000), "CallButton interactable never appeared").toBe(true)
    await sleep(500)

    const lines: string[] = []
    const onLine = (id: string) => lines.push(id)
    lens.voice.onLineSpoken.add(onLine)
    const startModeId = modes.currentModeId
    const interactor = new DeskCompanionLeafInteractor()
    try {
      // ── 1. Mode cycling ──
      await interactor.tap("CallButton")
      expect(await waitUntil(() => c.state === "attend", 6000), "she never came over after Call").toBe(true)
      expect(await waitUntil(() => !!findInteractableByName("ModeButton", undefined, true), 3000), "ModeButton never appeared").toBe(true)
      await sleep(400)
      const n = PERSONA_MODES.length
      let cueIdx = -1
      for (let i = 0; i < n; i++) if (PERSONA_MODES[i].cueCards.length > 0) cueIdx = i
      expect(cueIdx >= 0, "no mode with cue cards in persona/modes.md").toBe(true)
      const steps = (cueIdx - modes.currentModeIndex + n) % n
      let orderOk = true
      let lineOk = true
      let badgeOk = true
      const seen: string[] = []
      for (let k = 0; k < steps; k++) {
        const expected = PERSONA_MODES[(modes.currentModeIndex + 1) % n]
        await interactor.tap("ModeButton")
        await sleep(300)
        seen.push(modes.currentModeId)
        if (modes.currentModeId !== expected.id) orderOk = false
        if (lens.voice.lastLineId !== lineIdForMode(expected, "call", "call_whats_up")) lineOk = false
        if (lens.bubble.currentBadge !== DeskCompanionModeController.badgeFor(expected)) badgeOk = false
        if (k < steps - 1) await sleep(500)
      }
      checks.check("Mode moves through the modes in file order", orderOk && modes.currentModeId === PERSONA_MODES[cueIdx].id, `seen=${seen.join(">")}`)
      checks.check("she says each mode's call line", lineOk, `last=${lens.voice.lastLineId}`)
      checks.check("bubble badge 'Yori · <Name> mode'", badgeOk, `badge="${lens.bubble.currentBadge}"`)

      // ── 2. talk list beside her ──
      const shown = await waitUntil(() => modes.cueCardShown, 8000)
      const cueMode = PERSONA_MODES[cueIdx]
      const decks = cueMode.cueDecks && cueMode.cueDecks.length > 0 ? cueMode.cueDecks : [{name: cueMode.nameEn, cards: cueMode.cueCards}]
      const cards = decks[0].cards
      checks.check("talk list shows beside her at her spot", shown && !c.isNear, `cueCardShown=${modes.cueCardShown} state=${c.state} dist=${f1(c.distanceToUserCm)}`)
      checks.check(
        "every item listed, first highlighted with its note",
        list.rowCount === Math.min(cards.length, list.maxVisibleItems) && list.currentIndex === 0 && list.currentText === cards[0].text && list.currentNote === cards[0].note,
        `rows=${list.rowCount}/${cards.length} current=${list.currentIndex} text="${list.currentText.substring(0, 30)}…" note="${list.currentNote}"`
      )
      checks.check("total timer in the header", list.timerText.indexOf("Total ") === 0, `timer="${list.timerText}"`)

      // ── 3. time bar runs ──
      await sleep(1600)
      const shownSec = Math.floor(modes.cueCardElapsedSec)
      const barTime = "0:" + (shownSec < 10 ? "0" : "") + shownSec + " / "
      checks.check("item clock and time bar run", modes.cueCardElapsedSec >= 1 && list.barText.indexOf("■") >= 0 && list.barText.indexOf(barTime) >= 0, `cardElapsed=${f1(modes.cueCardElapsedSec)} bar="${list.barText}"`)

      // ── 4. Next / Back ──
      await interactor.tap("CueNextButton")
      await sleep(200)
      const afterNext = modes.cueIndex
      const nextLine = lens.voice.lastLineId
      await interactor.tap("CueBackButton")
      await sleep(200)
      checks.check("Next / Back move the highlight", afterNext === 1 && modes.cueIndex === 0 && list.currentIndex === 0, `afterNext=${afterNext} afterBack=${modes.cueIndex}`)
      checks.check("Next says cue_next", nextLine === lineIdForMode(PERSONA_MODES[cueIdx], "cue_next", ""), `line=${nextLine}`)

      // ── 5. slow-down whisper (item past 130 % of its time) ──
      modes.cueTimeScale = timeScale
      const slow = await waitUntil(() => lines.indexOf("cue_cards__cue_slow_down") >= 0, (cards[0].seconds * 1.3 / timeScale + 3) * 1000)
      checks.check("item over 130 % -> cue_slow_down", slow, `cardElapsed=${f1(modes.cueCardElapsedSec)} of ${cards[0].seconds} s; bar="${list.barText}"`)

      // ── 6. Auto ──
      await interactor.tap("CueAutoButton")
      await sleep(150)
      checks.check("Auto toggle on", modes.cueAuto && list.autoLabel === "Auto: On", `cueAuto=${modes.cueAuto} label="${list.autoLabel}"`)
      const finished = await waitUntil(() => modes.cueFinished, (modes.cuePlannedSec / timeScale + 6) * 1000)
      checks.check("Auto runs to the last item -> cue_done", finished && modes.cueIndex === cards.length - 1 && lines.indexOf("cue_cards__cue_done") >= 0, `finished=${finished} index=${modes.cueIndex} lines=${lines.join(",")}`)
      checks.check("60 s before the end -> cue_one_minute", lines.indexOf("cue_cards__cue_one_minute") >= 0, `lines=${lines.join(",")}`)
      checks.check("Auto switches off at the end", !modes.cueAuto && list.autoLabel === "Auto: Off", `cueAuto=${modes.cueAuto}`)

      // ── 7. Rehearse ──
      await interactor.tap("CueRehearseButton")
      await sleep(150)
      checks.check("Rehearse starts from the top in Auto", modes.cueRehearsing && modes.cueAuto && modes.cueIndex === 0, `rehearsing=${modes.cueRehearsing} auto=${modes.cueAuto} index=${modes.cueIndex}`)
      const done = await waitUntil(() => !modes.cueRehearsing, (modes.cuePlannedSec / timeScale + 6) * 1000)
      const en = lens.bubble.currentEn
      const m = /That took (\d+):(\d\d)/.exec(en)
      const measured = m ? parseInt(m[1]) * 60 + parseInt(m[2]) : -1
      const planned = modes.cuePlannedSec
      checks.check(
        "rehearsal ends with cue_rehearsal_done + measured total",
        done && lens.voice.lastLineId === "cue_cards__cue_rehearsal_done" && Math.abs(measured - planned) <= 6,
        `line=${lens.voice.lastLineId} subtitle="${en}" measured=${measured}s planned=${planned}s`
      )

      // ── 8. decks, jump, ±5s, reorder ──
      modes.cueTimeScale = 1
      if (decks.length > 1) {
        await interactor.tap("CueDeckButton")
        await sleep(200)
        const d1 = decks[1]
        checks.check("Deck ▶ switches deck", modes.cueDeckIndex === 1 && list.deckName === d1.name && modes.cueIndex === 0 && list.rowCount === Math.min(d1.cards.length, list.maxVisibleItems),
          `deck=${modes.cueDeckIndex} name="${list.deckName}" rows=${list.rowCount} index=${modes.cueIndex}`)
      }
      const slot = Math.min(3, list.rowCount - 1)
      const target = list.rowCardIndex(slot)
      await interactor.tap("CueRow_" + slot)
      await sleep(200)
      checks.check("pinch an item -> jump to it", modes.cueIndex === target && list.currentIndex === target, `tapped row ${slot} (item ${target}) -> index ${modes.cueIndex}`)
      const s0 = modes.cueCardSeconds(target)
      const p0 = modes.cuePlannedSec
      await interactor.tap("CuePlus5Button")
      await sleep(150)
      const s1 = modes.cueCardSeconds(target)
      const p1 = modes.cuePlannedSec
      await interactor.tap("CueMinus5Button")
      await sleep(150)
      checks.check("+5s / −5s change the item's time and the total", s1 === s0 + 5 && p1 === p0 + 5 && modes.cueCardSeconds(target) === s0,
        `seconds ${s0} -> ${s1} -> ${modes.cueCardSeconds(target)}; planned ${p0} -> ${p1}; timer="${list.timerText}"`)
      const movedText = list.currentText
      await interactor.tap("CueUpButton")
      await sleep(150)
      checks.check("▲ moves the current item up (highlight follows)", target === 0 || (modes.cueIndex === target - 1 && list.currentText === movedText),
        `index ${target} -> ${modes.cueIndex}; text kept=${list.currentText === movedText}`)

      // A− / A+ and stepping aside for the list
      await interactor.tap("CueBiggerButton")
      await sleep(150)
      const big = modes.cueScale
      await interactor.tap("CueSmallerButton")
      await sleep(150)
      checks.check("A+ / A− resize the list", Math.abs(big - 1.15) < 0.01 && Math.abs(modes.cueScale - 1) < 0.01, `scale 1 -> ${big} -> ${modes.cueScale}`)
      checks.check("she stands aside while the talk list is up", c.cardsAside && c.angleOffCenterDeg > 25, `cardsAside=${c.cardsAside} angle=${f1(c.angleOffCenterDeg)} dist=${f1(c.distanceToUserCm)}`)
    } finally {
      modes.cueTimeScale = 1
      lens.voice.onLineSpoken.remove(onLine)
      let guard = 0
      while (modes.currentModeId !== startModeId && guard++ < PERSONA_MODES.length) modes.cycleMode()
      log(`DC6 restored mode ${modes.currentModeId}; cardsAside=${c.cardsAside}`)
    }
    checks.finish()
  }
}
