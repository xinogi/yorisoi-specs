/**
 * DemoReelScenario ("demo-reel") — drives the Lens hands-free through devpost/video-script.md
 * (12 shots, ~2:40) so the demo video can be recorded from the primary preview. Not a test:
 * it never fails on purpose and is not part of DC1–DC10. Start it from LeafAutoRun with
 * scenarioIds "demo-reel" (or the LEAF panel).
 *
 * Each shot starts with a log line "[REEL] shot N <name> t=<seconds>" (seconds since the reel
 * started); her lines keep the usual "DeskCompanion says [id]" logs, so the audio track can be
 * rebuilt from the log timestamps. Head moves use LEAF's smooth head controller (no snaps).
 * Timed parts are sped up where the script says "(time cut)" / "(sped up)".
 * Everything is put back at the end (Sweetheart mode, music off, Yori visible, clocks at 1×).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHead, Lens, requireComponent, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {DeskCompanionModeController} from "../Scripts/DeskCompanionModeController"
import {DeskCompanionCueCardsUI} from "../Scripts/DeskCompanionCueCardsUI"
import {DeskCompanionSecretary} from "../Scripts/DeskCompanionSecretary"
import {DeskCompanionStretch} from "../Scripts/DeskCompanionStretch"

const DESK_PITCH = -14

@component
export class DemoReelScenario extends Scenario {
  private t0 = 0

  private shot(n: number, name: string): void {
    print("[REEL] shot " + n + " " + name + " t=" + (getTime() - this.t0).toFixed(1))
  }

  async run(config?: ScenarioConfig): Promise<void> {
    const lens = new Lens()
    const c = lens.controller
    const modes = requireComponent<DeskCompanionModeController>("CompanionModes", DeskCompanionModeController.getTypeName())
    const list = requireComponent<DeskCompanionCueCardsUI>("CueCards", DeskCompanionCueCardsUI.getTypeName())
    const sec = requireComponent<DeskCompanionSecretary>("Secretary", DeskCompanionSecretary.getTypeName())
    const stretch = requireComponent<DeskCompanionStretch>("Stretch", DeskCompanionStretch.getTypeName())
    await waitForLensReady(lens)
    await waitUntil(() => !!findInteractableByName("CallButton", undefined, true), 5000)
    const ui = new DeskCompanionLeafInteractor()
    const head = new LeafHead("leafHead", true)
    // tap helper: never let one missing button stop the reel
    const tap = async (name: string, after: number = 0.4): Promise<void> => {
      try {
        await ui.tap(name)
      } catch (e) {
        print("[REEL] (skipped tap " + name + ": " + e + ")")
      }
      if (after > 0) await sleep(after * 1000)
    }
    try {
      await head.turnTo(0, DESK_PITCH)
      await sleep(800)
      this.t0 = getTime()

      // 1 — quiet at the desk
      this.shot(1, "open-quiet")
      await sleep(10000)

      // 2 — look away, she glides back in front
      this.shot(2, "always-in-front")
      await head.turnTo(60, -8)
      await sleep(2200)
      await head.turnTo(0, DESK_PITCH)
      await sleep(1500)

      // 3 — Call her
      this.shot(3, "call")
      await tap("CallButton", 0)
      await waitUntil(() => c.state === "attend", 8000)
      await sleep(3500)

      // 4 — briefing (the first Call brings it; Briefing button otherwise) + stretch reminder timer
      this.shot(4, "briefing-and-reminder")
      if (!sec.briefingShown) await tap("BriefingButton", 0)
      await waitUntil(() => sec.briefingShown && sec.weatherSource !== "", 6000)
      await sleep(9000) // intro + "Want to rehearse it with me?"
      await tap("TimerButton", 0.6) // 1 min
      await tap("TimerButton", 0.6) // 5 min
      await tap("TimerButton", 0.4) // Stretch reminder (demo)
      sec.timeScale = 0 // hold the countdown until shot 7 (time cut)
      await sleep(3500)

      // 5 — rehearse on the cue-card talk list (she steps aside)
      this.shot(5, "cue-cards")
      for (let i = 0; i < 6 && modes.currentModeId !== "cue_cards"; i++) await tap("ModeButton", 0.5)
      await waitUntil(() => modes.cueCardShown, 8000)
      await sleep(2500)
      modes.cueTimeScale = 4 // (time cut)
      await tap("CueRehearseButton", 7)
      // jump to item 4, Auto off, shorten it twice, let it run long -> "slow down" whisper
      let slot = -1
      for (let s = 0; s < list.rowCount; s++) if (list.rowCardIndex(s) === 3) slot = s
      if (slot >= 0) await tap("CueRow_" + slot, 1.2)
      if (modes.cueAuto) await tap("CueAutoButton", 0.6)
      await tap("CueMinus5Button", 0.5)
      await tap("CueMinus5Button", 0.5)
      await waitUntil(() => modes.cueCardElapsedSec > modes.cueCardSeconds(modes.cueIndex) * 1.3 + 0.5, 12000)
      await sleep(3000)
      for (let i = 0; i < 4 && !modes.cueFinished; i++) await tap("CueNextButton", 1.3)
      await sleep(2500)
      modes.cueTimeScale = 1
      modes.enterMode("sweetheart") // leave cue mode; she comes back to her spot
      await sleep(2500)

      // 6 — real translation on the page
      this.shot(6, "translation")
      await head.turnTo(0, -48)
      await sleep(800)
      await tap("Word_bara", 7.5)
      await tap("Word_gamsahamnida", 6.5)
      await head.turnTo(0, DESK_PITCH)
      await sleep(1000)

      // 7 — the stretch reminder fires (sped up)
      this.shot(7, "reminder-fires")
      sec.timeScale = 12
      await waitUntil(() => sec.timerKind === "", 8000)
      sec.timeScale = 1
      await sleep(4500)

      // 8 — a quick stretch: two moves, then sped through to the end
      this.shot(8, "stretch")
      await tap("InfoShortcutButton", 0)
      if (!stretch.stretchActive) stretch.start()
      await waitUntil(() => stretch.stretchStep >= 1, 20000)
      await sleep(4500)
      stretch.timeScale = 20 // (sped up)
      await waitUntil(() => !stretch.stretchActive, 15000)
      stretch.timeScale = 1
      await sleep(3500)

      // 9 — music together
      this.shot(9, "music")
      await tap("CallButton", 0)
      await waitUntil(() => c.state === "attend", 8000)
      await sleep(800)
      await tap("MusicButton", 9)

      // 10 — voice only, then back
      this.shot(10, "voice-only")
      await tap("AvatarButton", 2)
      await tap("CallButton", 4.5)
      await tap("AvatarButton", 1.5)

      // 11 — montage
      this.shot(11, "montage")
      await waitUntil(() => !!findInteractableByName("ModeButton", undefined, true), 4000)
      await tap("ModeButton", 1.3)
      await tap("ModeButton", 1.3)
      await tap("ModeButton", 1.3)
      await tap("AskButton", 2)
      await tap("LookUpButton", 3.5)
      await tap("CompanionTouch", 2)

      // 12 — end card (she waves; the editor fades to the card)
      this.shot(12, "end")
      c.playGesture("wave")
      await sleep(8000)
      print("[REEL] end t=" + (getTime() - this.t0).toFixed(1))
    } finally {
      sec.timeScale = 1
      stretch.timeScale = 1
      modes.cueTimeScale = 1
      if (stretch.stretchActive) stretch.cancel()
      let guard = 0
      while (sec.musicTrack !== "off" && guard++ < 3) sec.cycleMusic()
      if (sec.timerKind !== "") {
        guard = 0
        while (sec.timerKind !== "" && guard++ < 5) sec.cycleTimer()
      }
      if (!c.avatarVisible) c.setAvatarVisible(true)
      if (modes.currentModeId !== "sweetheart") modes.enterMode("sweetheart")
      head.restore()
    }
  }
}
