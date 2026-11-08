/**
 * DeskCompanionStretch — the "Stretch" break routine (design brief "Stretch break").
 *
 * Owns: the routine state (single source of truth): intro line -> 4 moves (arms up, side stretch,
 *   shoulder rolls, neck tilt) -> "Great job! Feel better?" with a happy laugh. Each move plays its
 *   clip (stretch_<move>; while a clip is missing the animator falls back to dance / idle), says
 *   its voice line, and drives the card beside her: move name, a 1–2–3–4 count (~1 s per count)
 *   and a remaining-time bar. Any other button cancels it (DeskCompanionMain calls cancel()).
 * Inputs: controller (keeps her attending), voice, animator, card (DeskCompanionStretchCardUI).
 * Test hooks: stretchActive, stretchStep (-1 intro, 0..3 moves, 4 done), stretchCount.
 * Must not: build UI or move her.
 */
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {CompanionAnim, DeskCompanionAnimator} from "./DeskCompanionAnimator"
import {DeskCompanionStretchCardUI} from "./DeskCompanionStretchCardUI"

interface StretchMove { id: string; en: string; ja: string; anim: CompanionAnim; lineId: string }

export const STRETCH_MOVES: StretchMove[] = [
  {id: "arms_up", en: "Arms up", ja: "腕を上に", anim: "stretch_arms_up", lineId: "stretch_arms_up"},
  {id: "side", en: "Side stretch", ja: "横に倒す", anim: "stretch_side", lineId: "stretch_side"},
  {id: "shoulders", en: "Shoulder rolls", ja: "肩を回す", anim: "stretch_shoulders", lineId: "stretch_shoulders"},
  {id: "neck", en: "Neck tilt", ja: "首を傾ける", anim: "stretch_neck", lineId: "stretch_neck"}
]

@component
export class DeskCompanionStretch extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionStretch – stretch break routine (4 moves, count, timer)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Companion controller (keeps her attending during the routine)")
  controller: DeskCompanionController

  @input
  @hint("Voice + subtitles")
  voice: DeskCompanionVoice

  @input
  @hint("Animator (plays the stretch clips)")
  animator: DeskCompanionAnimator

  @input
  @hint("Card beside her: move name, count, time bar")
  card: DeskCompanionStretchCardUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0.6, 2, 0.1))
  @hint("Seconds per count (1–2–3–4)")
  countSeconds: number = 1

  @input
  @widget(new SliderWidget(1, 8, 1))
  @hint("Counts per move")
  countsPerMove: number = 4
  @ui.group_end

  /** Test hook: routine clock speed (1 = real time). */
  public timeScale: number = 1

  private _active = false
  private _step = -1
  private stepStart = 0
  private stepLen = 0
  private countStart = 0
  private clock = 0

  public get stretchActive(): boolean { return this._active }
  /** -1 = intro, 0..3 = moves, 4 = done line. */
  public get stretchStep(): number { return this._step }
  /** Current count on the card (0 before the first count). */
  public get stretchCount(): number { return this.card ? this.card.currentCount : 0 }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Start the routine (restarts it if already running). */
  public start(): void {
    this._active = true
    this.clock = 0
    this._step = -1
    const d = this.voice ? this.voice.say("stretch_intro") : 2.5
    if (this.animator) this.animator.playOnce("wave")
    this.stepStart = 0
    this.stepLen = Math.max(1.5, d) + 0.3
    this.countStart = Number.MAX_VALUE
    if (this.card) this.card.hide()
    // step back to her resting spot so her whole body (and the card beside her) is in view,
    // and stand still there (no idle wander walk over the stretch clips)
    if (this.controller) {
      this.controller.returnToSpot(false)
      this.controller.holdStill = true
    }
    print("DeskCompanionStretch: start")
  }

  /** Stop right away (another button was pressed). */
  public cancel(): void {
    if (!this._active) return
    this._active = false
    this._step = -1
    if (this.controller) this.controller.holdStill = false
    if (this.card) this.card.hide()
    print("DeskCompanionStretch: cancelled")
  }

  private beginMove(i: number): void {
    const m = STRETCH_MOVES[i]
    this._step = i
    this.stepStart = this.clock
    const d = this.voice ? this.voice.say(m.lineId) : 2
    if (this.animator) this.animator.playOnce(m.anim)
    this.countStart = this.clock + Math.min(1, d * 0.4)
    this.stepLen = Math.max(d + 0.5, (this.countStart - this.clock) + this.countsPerMove * this.countSeconds + 0.6)
    if (this.card) {
      this.card.showMove(m.en, m.ja, i, STRETCH_MOVES.length)
      this.card.setRemaining(1, this.stepLen)
    }
    print("DeskCompanionStretch: move " + (i + 1) + "/" + STRETCH_MOVES.length + " " + m.id)
  }

  private finish(): void {
    this._step = STRETCH_MOVES.length
    if (this.card) this.card.hide()
    if (this.voice) this.voice.say("stretch_done")
    if (this.animator) this.animator.playOnce("happy_laugh")
    if (this.controller) this.controller.holdStill = false
    this._active = false
    print("DeskCompanionStretch: done")
  }

  private tick(): void {
    if (!this._active) return
    this.clock += getDeltaTime() * Math.max(0, this.timeScale)
    if (this.controller) this.controller.noteInteraction() // keep her here while you stretch together
    const t = this.clock - this.stepStart
    if (this._step >= 0 && this.card) {
      const n = this.clock < this.countStart ? 0 : Math.min(this.countsPerMove, 1 + Math.floor((this.clock - this.countStart) / this.countSeconds))
      if (n !== this.card.currentCount) this.card.setCount(n, this.countsPerMove)
      this.card.setRemaining(1 - t / this.stepLen, (this.stepLen - t) / Math.max(0.01, this.timeScale))
    }
    if (t < this.stepLen) return
    // the first move waits (up to 6 s) until she has walked back to her spot
    if (this._step === -1 && this.controller && t < this.stepLen + 6) {
      const s = this.controller.state
      if (s === "leaving" || s === "roam_walk" || s === "approach" || this.controller.isRecentering) return
    }
    if (this._step + 1 < STRETCH_MOVES.length) this.beginMove(this._step + 1)
    else this.finish()
  }
}
