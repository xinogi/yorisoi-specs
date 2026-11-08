/**
 * DC8 — Ask + translation.
 *
 * 1. Call her over, then pinch Ask three times: the answers cycle weather -> today's plan ->
 *    project tip (ASK_ITEMS order); each time she says the answer line and the small answer card
 *    shows its text with the "sample data" label.
 * 2. A word from the page through the translator returns a non-empty meaning (live MyMemory or the
 *    offline fallback — either is a pass; the source is logged).
 * 3. Translate…: pinch it -> "Type anything…" (live_prompt); the preview has no AR keyboard, so a
 *    demo phrase is used after ~2 s -> a non-empty result with live_result or live_offline.
 * 4. Quiet: no extra line follows an answer (she does not chatter after Ask / Translate).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, Lens, log, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionModeController} from "../Scripts/DeskCompanionModeController"
import {DeskCompanionAskCardUI} from "../Scripts/DeskCompanionAskCardUI"
import {DeskCompanionTranslator} from "../Scripts/DeskCompanionTranslator"
import {DeskCompanionTranslateCardUI} from "../Scripts/DeskCompanionTranslateCardUI"
import {ASK_ITEMS, findWord} from "../Scripts/DeskCompanionContent"

@component
export class DC8AskAndTranslateScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const wordId = (config && config.get("word")) || "bara"
    const checks = new CheckList("DC8")
    const lens = new Lens()
    const c = lens.controller
    const modes = requireComponent<DeskCompanionModeController>("CompanionModes", DeskCompanionModeController.getTypeName())
    const askCard = requireComponent<DeskCompanionAskCardUI>("AskCard", DeskCompanionAskCardUI.getTypeName())
    const translator = requireComponent<DeskCompanionTranslator>("Translator", DeskCompanionTranslator.getTypeName())
    const trCard = requireComponent<DeskCompanionTranslateCardUI>("TranslateCard", DeskCompanionTranslateCardUI.getTypeName())
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
      expect(await waitUntil(() => !!findInteractableByName("AskButton", undefined, true), 3000), "AskButton never appeared").toBe(true)
      await sleep(400)

      // ── 1. Ask cycles weather -> plan -> project ──
      const asked: string[] = []
      let lineOk = true
      let cardOk = true
      const gestures: string[] = []
      for (let k = 0; k < ASK_ITEMS.length; k++) {
        await interactor.tap("AskButton")
        await sleep(250)
        gestures.push(lens.animator.currentAnim)
        const item = ASK_ITEMS.filter((a) => a.id === modes.lastAskId)[0]
        asked.push(modes.lastAskId)
        if (!item || lens.voice.lastLineId !== item.lineId) lineOk = false
        if (!item || !askCard.isShown || askCard.currentText !== item.card) cardOk = false
        await sleep(600)
      }
      const start = ASK_ITEMS.map((a) => a.id).indexOf(asked[0])
      let orderOk = start >= 0
      for (let k = 0; k < asked.length && orderOk; k++) orderOk = asked[k] === ASK_ITEMS[(start + k) % ASK_ITEMS.length].id
      checks.check("Ask cycles weather -> plan -> project", orderOk && new Set(asked).size === ASK_ITEMS.length, `asked=${asked.join(">")}`)
      checks.check("she says each answer", lineOk, `last=${lens.voice.lastLineId}`)
      checks.check("answer card shows the short answer", cardOk, `card="${askCard.currentText}"`)
      checks.check("she nods with each answer", gestures.every((g) => g === "nod"), `anims=${gestures.join(",")}`)

      // quiet after Ask: nothing else is said for a few seconds
      const afterAsk = lines.length
      await sleep(3000)
      checks.check("no extra line after an Ask answer", lines.length === afterAsk, `extra=${lines.slice(afterAsk).join(",") || "-"}`)

      // ── 2. word translation (live or offline) ──
      const w = findWord(wordId)
      expect(!!w, `word ${wordId} not on the page`).toBe(true)
      const r = await translator.translateWord(w)
      checks.check(`word "${w.word}" -> non-empty meaning (${r.source})`, !!r.meaningEn && r.meaningEn.length > 0 && (r.source === "live" || r.source === "offline"), `meaningEn="${r.meaningEn}" meaningJa="${r.meaningJa}" source=${r.source}`)

      // ── 3. Translate… free text ──
      const before = lines.length
      await interactor.tap("TranslateButton")
      await sleep(200)
      checks.check("Translate… asks what to translate (live_prompt)", lines.slice(before).indexOf("live_prompt") >= 0, `lines=${lines.slice(before).join(",")}`)
      const answered = await waitUntil(() => lines.slice(before).some((id) => id === "live_result" || id === "live_offline") && !translator.isBusy, 12000)
      const src = translator.lastTranslationSource
      const text = translator.lastTranslationText
      checks.check(
        "free text -> non-empty result (live or offline)",
        answered && text.length > 0 && (src === "live" || src === "offline") && trCard.isShown,
        `source=${src} text="${text}" card=${trCard.isShown} english="${trCard.currentEnglish}"`
      )
      const afterTr = lines.length
      await sleep(3000)
      checks.check("no extra line after the translation", lines.length === afterTr, `extra=${lines.slice(afterTr).join(",") || "-"}`)
      log(`DC8 lines: ${lines.join(",")}`)
    } finally {
      lens.voice.onLineSpoken.remove(onLine)
    }
    checks.finish()
  }
}
