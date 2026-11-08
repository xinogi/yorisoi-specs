/**
 * DC10 — Briefing, timer, music.
 * 1. Briefing button: the card beside her shows Tokyo weather (live from Open-Meteo, or the sample
 *    labelled "offline"), today's tasks and a reminder; she says briefing_intro.
 * 2. Timer: pinch Timer until "Talk in 1 min (demo 20 s)"; the countdown runs (clock sped up,
 *    parameter timeScale "10") and fires reminder_talk.
 * 3. Music: Off -> Focus -> Relax -> Calm -> Off (music_on / music_off lines; missing tracks are allowed).
 * 4. Look up: the first preset topic (Risotto) shows a summary (live Wikipedia or offline) with the
 *    "Source: Wikipedia (CC BY-SA)" line.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, f1, Lens, log, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionSecretary} from "../Scripts/DeskCompanionSecretary"
import {DeskCompanionInfoCardUI} from "../Scripts/DeskCompanionInfoCardUI"

@component
export class DC10SecretaryScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const timeScale = (config && config.getNumber("timeScale")) || 10
    const checks = new CheckList("DC10")
    const lens = new Lens()
    const c = lens.controller
    const sec = requireComponent<DeskCompanionSecretary>("Secretary", DeskCompanionSecretary.getTypeName())
    const card = requireComponent<DeskCompanionInfoCardUI>("InfoCard", DeskCompanionInfoCardUI.getTypeName())
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
      expect(await waitUntil(() => !!findInteractableByName("BriefingButton", undefined, true), 3000), "BriefingButton never appeared").toBe(true)
      await sleep(400)

      // ── 1. briefing ──
      await interactor.tap("BriefingButton")
      const got = await waitUntil(() => sec.briefingShown && sec.weatherSource !== "", 8000)
      checks.check("briefing card with Tokyo weather (live or offline)", got && card.isShown && card.currentTitle.indexOf("Tokyo") >= 0 && card.currentText.indexOf("Today:") >= 0 && lines.indexOf("briefing_intro") >= 0,
        `source=${sec.weatherSource} title="${card.currentTitle}" text="${card.currentText.replace(/\n/g, " | ")}" shortcut=${card.shortcutText}`)

      // ── 2. timer ──
      sec.timeScale = timeScale
      await interactor.tap("TimerButton")
      await sleep(150)
      const first = sec.timerKind
      const firstRemaining = sec.timerRemaining
      for (let i = 0; i < 3; i++) {
        await sleep(300)
        await interactor.tap("TimerButton")
      }
      await sleep(150)
      checks.check("Timer cycles presets (1 min ... Talk in 1 min)", first === "timer" && firstRemaining > 50 && sec.timerKind === "talk", `first=${first} ${f1(firstRemaining)} s -> kind=${sec.timerKind} remaining=${f1(sec.timerRemaining)}`)
      const r0 = sec.timerRemaining
      await sleep(600)
      checks.check("countdown runs", sec.timerRemaining < r0 && card.isShown, `remaining ${f1(r0)} -> ${f1(sec.timerRemaining)}`)
      const fired = await waitUntil(() => sec.timerKind === "" && lines.indexOf("reminder_talk") >= 0, (20 / timeScale + 4) * 1000)
      checks.check("timer fires the talk reminder", fired, `kind=${sec.timerKind} lines=${lines.join(",")}`)

      // ── 3. music ──
      const seq: string[] = []
      const playing: boolean[] = []
      let duckOk = false
      let fullOk = false
      for (let i = 0; i < 4; i++) {
        await sleep(400)
        await interactor.tap("MusicButton")
        await sleep(150)
        seq.push(sec.musicTrack)
        playing.push(sec.musicPlaying)
        if (i === 0) {
          // she answers "Let's listen…" -> music ducks; after she stops talking it comes back up
          duckOk = lens.voice.isSpeaking && sec.musicCurrentVolume <= sec.musicDuckVolume + 0.001
          await waitUntil(() => !lens.voice.isSpeaking, 6000)
          await sleep(200)
          fullOk = Math.abs(sec.musicCurrentVolume - sec.musicVolume) < 0.01
        }
      }
      checks.check("music really plays (Focus, Relax, Calm) and stops (Off)", playing.join(",") === "true,true,true,false", `playing=${playing.join(",")}`)
      checks.check("music ducks while she speaks, back up after", duckOk && fullOk, `duck=${duckOk} full=${fullOk} volume=${f1(sec.musicCurrentVolume)} (set ${sec.musicVolume}, duck ${sec.musicDuckVolume})`)
      checks.check("Music cycles Off -> Focus -> Relax -> Calm -> Off", seq.join(">") === "focus>relax>calm>off" && lines.indexOf("music_on") >= 0 && lens.voice.lastLineId === "music_off", `seq=${seq.join(">")} last=${lens.voice.lastLineId}`)

      // ── 4. look it up ──
      await sleep(400)
      await interactor.tap("LookUpButton")
      const looked = await waitUntil(() => sec.lastLookupTitle !== "" && card.isShown && card.currentText.indexOf("Source: Wikipedia") >= 0, 9000)
      checks.check("Look up shows a summary with the Wikipedia source (live or offline)", looked && (sec.lookupSource === "live" || sec.lookupSource === "offline"),
        `title=${sec.lastLookupTitle} source=${sec.lookupSource} card="${card.currentTitle}" text="${card.currentText.substring(0, 120)}…"`)
      log(`DC10 lines: ${lines.join(",")}`)
    } finally {
      sec.timeScale = 1
      lens.voice.onLineSpoken.remove(onLine)
    }
    checks.finish()
  }
}
