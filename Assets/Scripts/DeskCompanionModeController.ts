/**
 * DeskCompanionModeController — her persona modes (persona/modes.md -> DeskCompanionPersonaData.ts)
 * and the cue cards.
 *
 * Owns: the active mode and the cue-card index (single source of truth for both).
 *   - cycleMode(): next mode in file order (Sweetheart -> Smart -> Secretary -> Dance -> Healing ->
 *     Cue cards -> ...). She answers with the new mode's "call" line and the bubble shows the mode
 *     name briefly ("Smart mode · 知的モード"). The mode is applied to the controller (tease
 *     interval, wander size, favourite idle clips, call / tease / leave lines).
 *   - Cue cards mode: the card beside her shows mode.cueCards one at a time while she is at her
 *     resting spot (hidden while she is up close). Next -> next card + "cue_next" line; Next on the
 *     last card -> "cue_done" ("You did great!"). Back -> previous card.
 *   Ask (every mode; brief "Ask her"): each press cycles weather -> today's plan -> project tip;
 *     she answers out loud and a small card with the short answer + "sample data" label shows
 *     beside her for ~`askHoldSeconds` (or until the next Ask).
 * Translation and the book hand-off are the same in every mode (not touched here).
 *
 * Test hooks: currentModeId, currentModeIndex, modeIds, cueIndex, cueCount, cueCardShown,
 * lastAskId, askCardShown, onModeChanged.
 * Must not: build UI (DeskCompanionCueCardsUI / DeskCompanionActionsUI do) or move her directly.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionCueCardsUI} from "./DeskCompanionCueCardsUI"
import {DeskCompanionAskCardUI} from "./DeskCompanionAskCardUI"
import {PERSONA_MODES, PersonaMode} from "./DeskCompanionPersonaData"
import {ASK_ITEMS, lineIdForMode} from "./DeskCompanionContent"

@component
export class DeskCompanionModeController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionModeController – persona modes + cue cards (persona/modes.md)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Companion controller the active mode is applied to")
  controller: DeskCompanionController

  @input
  @hint("Voice + subtitles (mode call line, cue_next, cue_done)")
  voice: DeskCompanionVoice

  @input
  @hint("Cue card beside her (Cue cards mode)")
  cueCards: DeskCompanionCueCardsUI

  @input
  @hint("Small answer card beside her head (Ask button)")
  askCard: DeskCompanionAskCardUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(3, 20, 0.5))
  @hint("Seconds the Ask answer card stays beside her")
  askHoldSeconds: number = 8
  @ui.group_end

  private modeIndex = 0
  private _cueIndex = 0
  private askIndex = -1
  private _lastAskId = ""
  private askHideAt = -1
  private ready = false
  private _onModeChanged = new Event<string>()
  /** Set by DeskCompanionMain: called right before an Ask card shows (so other cards can hide). */
  public onAskShown: (() => void) | null = null

  /** Fires with the new mode id after every switch. */
  get onModeChanged(): PublicApi<string> { return this._onModeChanged.publicApi() }

  public get currentMode(): PersonaMode { return PERSONA_MODES[this.modeIndex] }
  public get currentModeId(): string { return this.currentMode.id }
  public get currentModeIndex(): number { return this.modeIndex }
  public get modeIds(): string[] { return PERSONA_MODES.map((m) => m.id) }
  public get cueIndex(): number { return this._cueIndex }
  public get cueCount(): number { return this.currentMode.cueCards.length }
  /** Id of the last Ask answer ("ask_weather" | "ask_plan" | "ask_project"), "" before the first. */
  public get lastAskId(): string { return this._lastAskId }
  /** True while the Ask answer card is visible beside her. */
  public get askCardShown(): boolean { return !!this.askCard && this.askCard.isShown }

  /** True while the cue card is actually visible beside her. */
  public get cueCardShown(): boolean { return !!this.cueCards && this.cueCards.isShown }

  /** Badge text shown in the bubble right after a switch, e.g. "Yori · Smart mode · 知的モード". */
  public static badgeFor(m: PersonaMode): string {
    return "Yori · " + m.nameEn + " mode · " + m.nameJa + "モード"
  }

  /** Hide the Ask card now (e.g. when a translation card takes its place). */
  public hideAskCard(): void {
    this.askHideAt = -1
    if (this.askCard) this.askCard.hide()
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private start(): void {
    let idx = 0
    for (let i = 0; i < PERSONA_MODES.length; i++) {
      if (PERSONA_MODES[i].isDefault) idx = i
    }
    this.modeIndex = idx
    if (this.controller) this.controller.applyMode(this.currentMode) // silent at start
    if (this.cueCards) {
      this.cueCards.onNext.add(() => this.cueNext())
      this.cueCards.onBack.add(() => this.cueBack())
    }
    this.ready = true
    print("DeskCompanionModes: start in " + this.currentModeId + " (" + PERSONA_MODES.length + " modes)")
  }

  /** Switch to the next mode; she answers with its call line. */
  public cycleMode(): void {
    if (PERSONA_MODES.length === 0) return
    this.modeIndex = (this.modeIndex + 1) % PERSONA_MODES.length
    const m = this.currentMode
    if (this.controller) {
      this.controller.applyMode(m)
      this.controller.noteInteraction()
    }
    if (this.voice) this.voice.say(lineIdForMode(m, "call", "call_whats_up"), DeskCompanionModeController.badgeFor(m))
    if (m.cueCards.length > 0) {
      this._cueIndex = 0
      if (this.cueCards) this.cueCards.setCard(m.cueCards[0], 0, m.cueCards.length)
      // step back to her spot so the card can show beside her
      if (this.controller) this.controller.returnToSpot(false)
    }
    print("DeskCompanionModes: mode -> " + m.id)
    this._onModeChanged.invoke(m.id)
  }

  /** Ask her the next everyday question (sample answers): weather -> today's plan -> project tip. */
  public ask(): void {
    if (ASK_ITEMS.length === 0) return
    this.askIndex = (this.askIndex + 1) % ASK_ITEMS.length
    const item = ASK_ITEMS[this.askIndex]
    this._lastAskId = item.id
    if (this.controller) this.controller.noteInteraction()
    if (this.onAskShown) this.onAskShown()
    const d = this.voice ? this.voice.say(item.lineId) : 4
    if (this.askCard) this.askCard.showCard(item.glyph, item.card)
    this.askHideAt = getTime() + Math.max(this.askHoldSeconds, d)
    print("DeskCompanionModes: ask -> " + item.id)
  }

  /** Next cue card; on the last card she says "You did great!". */
  public cueNext(): void {
    const m = this.currentMode
    if (m.cueCards.length === 0) return
    if (this.controller) this.controller.noteInteraction()
    if (this._cueIndex < m.cueCards.length - 1) {
      this._cueIndex++
      if (this.cueCards) this.cueCards.setCard(m.cueCards[this._cueIndex], this._cueIndex, m.cueCards.length)
      if (this.voice && m.lines["cue_next"]) this.voice.say(lineIdForMode(m, "cue_next", ""))
    } else if (this.voice && m.lines["cue_done"]) {
      this.voice.say(lineIdForMode(m, "cue_done", ""))
    }
    print("DeskCompanionModes: cue -> " + (this._cueIndex + 1) + "/" + m.cueCards.length)
  }

  /** Previous cue card. */
  public cueBack(): void {
    const m = this.currentMode
    if (m.cueCards.length === 0) return
    if (this.controller) this.controller.noteInteraction()
    if (this._cueIndex > 0) {
      this._cueIndex--
      if (this.cueCards) this.cueCards.setCard(m.cueCards[this._cueIndex], this._cueIndex, m.cueCards.length)
    }
  }

  private tick(): void {
    if (!this.ready) return
    if (this.askHideAt > 0 && getTime() >= this.askHideAt) {
      this.askHideAt = -1
      if (this.askCard) this.askCard.hide()
    }
    if (!this.cueCards) return
    const m = this.currentMode
    const atSpot = !!this.controller && !this.controller.isNear && this.controller.state !== "approach"
    const want = m.cueCards.length > 0 && atSpot
    if (want && !this.cueCards.isShown) {
      this.cueCards.setCard(m.cueCards[this._cueIndex], this._cueIndex, m.cueCards.length)
      this.cueCards.show()
    } else if (!want && this.cueCards.isShown) {
      this.cueCards.hide()
    }
  }
}
