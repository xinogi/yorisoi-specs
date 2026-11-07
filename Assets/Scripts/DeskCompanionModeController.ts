/**
 * DeskCompanionModeController — her persona modes (persona/modes.md -> DeskCompanionPersonaData.ts)
 * and the cue-card talk list.
 *
 * Owns: the active mode and the talk-list state (single source of truth for both).
 *   - cycleMode(): next mode in file order (Sweetheart -> Smart -> Secretary -> Dance -> Healing ->
 *     Cue cards -> ...). She answers with the new mode's "call" line and the bubble shows the mode
 *     name briefly ("Yori · Smart mode · 知的モード"). The mode is applied to the controller (tease
 *     interval, wander size, favourite idle clips, call / tease / leave lines).
 *   - Cue cards mode: the whole talk list stays beside her while she is at her resting spot
 *     (hidden while she is up close). Each item has a target time (cueCards[i].seconds):
 *       Next / Back move the highlight (Next says "cue_next"; Next on the last item -> "cue_done").
 *       Auto (toggle) moves on by itself when an item's time runs out.
 *       Coaching: an item running past 130 % of its time -> "cue_slow_down" (once per item);
 *       60 s left of the planned total -> "cue_one_minute" (once per run); last item -> "cue_done".
 *       Rehearse: runs the deck from the top in Auto, then "cue_rehearsal_done" with the measured
 *       total in the subtitle.
 *     Time only runs while the list is visible.
 *     Decks (persona/modes.md cueDecks): Deck ▶ cycles them; pinching an item jumps to it; −5s / +5s
 *     change the current item's time; ▲ / ▼ move it up / down. Edits are session-only (a copy of
 *     the deck) — permanent changes go in persona/modes.md.
 *   Ask (every mode; brief "Ask her"): each press cycles weather -> today's plan -> project tip;
 *     she answers out loud and a small card with the short answer + "sample data" label shows
 *     beside her for ~`askHoldSeconds` (or until the next Ask).
 * Translation and the book hand-off are the same in every mode (not touched here).
 *
 * Test hooks: currentModeId, currentModeIndex, modeIds, cueIndex, cueCount, cueCardShown, cueAuto,
 * cueDeckIndex, cueDeckName, cueDeckCount, cueCardSeconds(i),
 * cueElapsedSec, cueCardElapsedSec, cueRehearsing, cueFinished, cueTimeScale, lastAskId,
 * askCardShown, onModeChanged.
 * Must not: build UI (DeskCompanionCueCardsUI / DeskCompanionActionsUI do) or move her directly.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionCueCardsUI} from "./DeskCompanionCueCardsUI"
import {DeskCompanionAskCardUI} from "./DeskCompanionAskCardUI"
import {CueCard, CueDeck, PERSONA_MODES, PersonaMode} from "./DeskCompanionPersonaData"
import {ASK_ITEMS, lineIdForMode} from "./DeskCompanionContent"
import {DeskCompanionBillboard} from "./DeskCompanionBillboard"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/** In Cue cards mode the talk list sits in the middle of the view: this far ahead, this far below the eyes (cm). */
const LIST_AHEAD_CM = 190
const LIST_BELOW_EYES_CM = 22

/** An item running longer than this share of its target time gets a "slow down" whisper. */
const SLOW_DOWN_RATIO = 1.3
/** "One minute left" fires when this many seconds of the planned total remain. */
const ONE_MINUTE_S = 60

function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ":" + (r < 10 ? "0" : "") + r
}

@component
export class DeskCompanionModeController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionModeController – persona modes + cue-card talk list (persona/modes.md)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Companion controller the active mode is applied to")
  controller: DeskCompanionController

  @input
  @hint("Voice + subtitles (mode call line, cue coaching lines)")
  voice: DeskCompanionVoice

  @input
  @hint("Talk list beside her (Cue cards mode)")
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

  /** Test hook: talk-list clock speed (1 = real time). */
  public cueTimeScale: number = 1

  private modeIndex = 0
  private _deckIndex = 0
  private listBillboard: DeskCompanionBillboard | null = null
  private listOffsetDefault: vec3 | null = null
  private camT: Transform | null = null
  private deckCards: CueCard[] = [] // session copy of the current deck (edits stay here)
  private _cueIndex = 0
  private _cueAuto = false
  private autoBeforeRehearse = false
  private _rehearsing = false
  private _finished = false
  private cueTotal = 0 // seconds the list has been running (scaled)
  private cueCardTime = 0 // seconds on the current item (scaled)
  private slowDownSaid = false
  private oneMinuteSaid = false
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
  public get cueCount(): number { return this.deckCards.length }
  /** Talk-list size (A− / A+, 0.7–1.6, session-only). */
  public get cueScale(): number { return this.cueCards ? this.cueCards.cueScale : 1 }
  /** Index of the current deck in the mode's cueDecks. */
  public get cueDeckIndex(): number { return this._deckIndex }
  /** Name of the current deck. */
  public get cueDeckName(): string { const d = this.decksOf(this.currentMode)[this._deckIndex]; return d ? d.name : "" }
  /** Number of decks in the current mode. */
  public get cueDeckCount(): number { return this.decksOf(this.currentMode).length }
  /** Target seconds of item i in the current (possibly edited) deck. */
  public cueCardSeconds(i: number): number { return this.deckCards[i] ? this.deckCards[i].seconds : 0 }
  /** True while Auto advance is on (also during a rehearsal). */
  public get cueAuto(): boolean { return this._cueAuto }
  /** Seconds the talk list has been running (total elapsed of the talk). */
  public get cueElapsedSec(): number { return this.cueTotal }
  /** Seconds spent on the current item. */
  public get cueCardElapsedSec(): number { return this.cueCardTime }
  /** True while a rehearsal run is in progress. */
  public get cueRehearsing(): boolean { return this._rehearsing }
  /** True after the last item finished (clock stopped) until Back / Rehearse / re-entering the mode. */
  public get cueFinished(): boolean { return this._finished }
  /** Sum of the items' target seconds. */
  public get cuePlannedSec(): number {
    let t = 0
    for (const c of this.deckCards) t += Math.max(0, c.seconds || 0)
    return t
  }
  /** Id of the last Ask answer ("ask_weather" | "ask_plan" | "ask_project"), "" before the first. */
  public get lastAskId(): string { return this._lastAskId }
  /** True while the Ask answer card is visible beside her. */
  public get askCardShown(): boolean { return !!this.askCard && this.askCard.isShown }

  /** True while the talk list is actually visible beside her. */
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
      this.cueCards.onAutoToggle.add(() => this.setCueAuto(!this._cueAuto))
      this.cueCards.onRehearse.add(() => this.rehearse())
      this.cueCards.onDeck.add(() => this.cycleDeck())
      this.cueCards.onJump.add((i: number) => this.jumpTo(i))
      this.cueCards.onAdjust.add((d: number) => this.adjustSeconds(d))
      this.cueCards.onMove.add((dir: number) => this.moveCard(dir))
      this.cueCards.setAuto(this._cueAuto)
    }
    this.loadDeck(0)
    if (this.cueCards) {
      this.listBillboard = this.cueCards.getSceneObject().getComponent(DeskCompanionBillboard.getTypeName()) as DeskCompanionBillboard
      if (this.listBillboard) this.listOffsetDefault = this.listBillboard.offsetCm
    }
    this.camT = WorldCameraFinderProvider.getInstance().getTransform()
    if (this.controller) this.controller.setCardsAside(this.deckCards.length > 0)
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
    this.resetTalk(false)
    this.loadDeck(0)
    if (this.controller) this.controller.setCardsAside(this.deckCards.length > 0)
    if (this.deckCards.length > 0) {
      // step back to her spot so the list can show beside her
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

  // ───────────────────────────── talk list ─────────────────────────────

  /** Next item (manual). On the last item she says "You did great!". */
  public cueNext(): void {
    if (this.cueCount === 0) return
    if (this.controller) this.controller.noteInteraction()
    this.advance(false)
  }

  /** Previous item. */
  public cueBack(): void {
    if (this.cueCount === 0) return
    if (this.controller) this.controller.noteInteraction()
    if (this._rehearsing) this.stopRehearsal()
    this._finished = false
    if (this._cueIndex > 0) this.goTo(this._cueIndex - 1)
  }

  /** Auto on: the list moves on by itself when an item's target time runs out. */
  public setCueAuto(on: boolean): void {
    if (this.controller) this.controller.noteInteraction()
    this._cueAuto = on
    if (!on && this._rehearsing) this._rehearsing = false
    if (this.cueCards) this.cueCards.setAuto(on)
    print("DeskCompanionModes: cue auto " + (on ? "on" : "off"))
  }

  /** Rehearse: run the whole deck from the top in Auto, then tell the measured total. */
  public rehearse(): void {
    if (this.cueCount === 0) return
    if (this.controller) {
      this.controller.noteInteraction()
      this.controller.returnToSpot(false) // the list shows beside her at her spot
    }
    this.autoBeforeRehearse = this._rehearsing ? this.autoBeforeRehearse : this._cueAuto
    this.resetTalk(true)
    this._rehearsing = true
    this._cueAuto = true
    if (this.cueCards) this.cueCards.setAuto(true)
    print("DeskCompanionModes: rehearsal start (" + this.cueCount + " items, planned " + mmss(this.cuePlannedSec) + ")")
  }

  /** Decks of a mode: cueDecks from persona/modes.md, or its plain cue cards as one deck. */
  private decksOf(m: PersonaMode): CueDeck[] {
    if (m.cueDecks && m.cueDecks.length > 0) return m.cueDecks
    return m.cueCards.length > 0 ? [{name: m.nameEn, cards: m.cueCards}] : []
  }

  /** Load deck i of the current mode as a fresh session copy and restart the talk clock. */
  private loadDeck(i: number): void {
    const decks = this.decksOf(this.currentMode)
    this._deckIndex = decks.length > 0 ? ((i % decks.length) + decks.length) % decks.length : 0
    const d = decks[this._deckIndex]
    this.deckCards = d ? d.cards.map((c) => ({text: c.text, note: c.note || "", seconds: c.seconds || 0, details: (c.details || []).slice()})) : []
    this.resetTalk(false)
    if (this.cueCards) {
      this.cueCards.setDeck(this.deckCards, d ? d.name : "")
      this.cueCards.setProgress(0, 0, 0)
    }
  }

  /** Deck ▶: next deck (starts from its first item). */
  public cycleDeck(): void {
    if (this.cueDeckCount === 0) return
    if (this.controller) this.controller.noteInteraction()
    this.loadDeck(this._deckIndex + 1)
    print("DeskCompanionModes: deck -> " + this.cueDeckName)
  }

  /** Pinched an item in the list: jump to it. */
  public jumpTo(i: number): void {
    if (i < 0 || i >= this.deckCards.length) return
    if (this.controller) this.controller.noteInteraction()
    this._finished = false
    this.goTo(i)
  }

  /** −5s / +5s on the current item (never below 5 s). Session-only. */
  public adjustSeconds(delta: number): void {
    const c = this.deckCards[this._cueIndex]
    if (!c) return
    if (this.controller) this.controller.noteInteraction()
    c.seconds = Math.max(5, (c.seconds || 0) + delta)
    this.refreshList()
    print("DeskCompanionModes: item " + (this._cueIndex + 1) + " -> " + c.seconds + " s (planned " + mmss(this.cuePlannedSec) + ")")
  }

  /** ▲ / ▼: move the current item up (-1) or down (+1); the highlight follows it. Session-only. */
  public moveCard(dir: number): void {
    const j = this._cueIndex + (dir < 0 ? -1 : 1)
    if (j < 0 || j >= this.deckCards.length) return
    if (this.controller) this.controller.noteInteraction()
    const tmp = this.deckCards[j]
    this.deckCards[j] = this.deckCards[this._cueIndex]
    this.deckCards[this._cueIndex] = tmp
    this._cueIndex = j
    this.refreshList()
  }

  /** In Cue cards mode keep the list in the middle of the view (she stands aside); else beside her. */
  private placeList(cueMode: boolean): void {
    if (!this.listBillboard || !this.controller || !this.camT) return
    if (!cueMode || !this.controller.cardsAside) {
      if (this.listOffsetDefault) this.listBillboard.offsetCm = this.listOffsetDefault
      return
    }
    const cam = this.camT.getWorldPosition()
    const f = this.camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(f.x, 0, f.z)
    const fwd = flat.length > 0.2 ? flat.normalize() : new vec3(0, 0, -1)
    const want = cam.add(fwd.uniformScale(LIST_AHEAD_CM)).add(new vec3(0, -LIST_BELOW_EYES_CM, 0))
    const base = this.controller.getTransform().getWorldPosition()
    const toCam = new vec3(cam.x - base.x, 0, cam.z - base.z)
    const flatToCam = toCam.length > 0.001 ? toCam.normalize() : new vec3(0, 0, 1)
    const right = new vec3(flatToCam.z, 0, -flatToCam.x) // same frame as DeskCompanionBillboard
    const d = want.sub(base)
    this.listBillboard.offsetCm = new vec3(d.dot(right), d.y, d.dot(flatToCam))
  }

  private refreshList(): void {
    if (!this.cueCards) return
    this.cueCards.setDeck(this.deckCards, this.cueDeckName)
    this.cueCards.setProgress(this._cueIndex, this.cueCardTime, this.cueTotal)
  }

  private advance(auto: boolean): void {
    const m = this.currentMode
    if (this._cueIndex < this.deckCards.length - 1) {
      this.goTo(this._cueIndex + 1)
      // manual Next gets a short "Next one."; Auto moves on silently (no chatter during the talk)
      if (!auto && this.voice && m.lines["cue_next"]) this.voice.say(lineIdForMode(m, "cue_next", ""))
      return
    }
    // past the last item
    if (this._rehearsing) {
      this.finishRehearsal()
      return
    }
    this._finished = true
    if (this.voice && m.lines["cue_done"]) this.voice.say(lineIdForMode(m, "cue_done", ""))
    if (auto) this.setCueAuto(false)
    print("DeskCompanionModes: cue done at " + mmss(this.cueTotal))
  }

  private goTo(index: number): void {
    this._cueIndex = index
    this.cueCardTime = 0
    this.slowDownSaid = false
    if (this.cueCards) this.cueCards.setProgress(this._cueIndex, 0, this.cueTotal)
    print("DeskCompanionModes: cue -> " + (this._cueIndex + 1) + "/" + this.cueCount)
  }

  private finishRehearsal(): void {
    const m = this.currentMode
    const total = this.cueTotal
    this._finished = true
    this.stopRehearsal()
    const id = lineIdForMode(m, "cue_rehearsal_done", "")
    if (this.voice && m.lines["cue_rehearsal_done"]) {
      const t = mmss(total)
      const sec = Math.max(0, Math.round(total))
      const ja = (sec >= 60 ? Math.floor(sec / 60) + "分" : "") + (sec % 60) + "秒。いいペースだったよ！"
      this.voice.say(id, "", {en: "That took " + t + ". Nice pace!", ja: ja})
    }
    print("DeskCompanionModes: rehearsal done in " + mmss(total) + " (planned " + mmss(this.cuePlannedSec) + ")")
  }

  private stopRehearsal(): void {
    this._rehearsing = false
    this._cueAuto = this.autoBeforeRehearse
    if (this.cueCards) this.cueCards.setAuto(this._cueAuto)
  }

  private resetTalk(keepAuto: boolean): void {
    this._cueIndex = 0
    this.cueTotal = 0
    this.cueCardTime = 0
    this.slowDownSaid = false
    this.oneMinuteSaid = false
    this._finished = false
    if (!keepAuto && this._rehearsing) this.stopRehearsal()
    if (this.cueCards) this.cueCards.setProgress(0, 0, 0)
  }

  private tickTalk(dt: number, cards: CueCard[]): void {
    if (this._finished || cards.length === 0) return
    const step = dt * Math.max(0, this.cueTimeScale)
    this.cueTotal += step
    this.cueCardTime += step
    const card = cards[this._cueIndex]
    const m = this.currentMode
    if (card && card.seconds > 0) {
      if (this._cueAuto && this.cueCardTime >= card.seconds) {
        this.advance(true)
      } else if (!this.slowDownSaid && this.cueCardTime > card.seconds * SLOW_DOWN_RATIO) {
        this.slowDownSaid = true
        if (this.voice && m.lines["cue_slow_down"]) this.voice.say(lineIdForMode(m, "cue_slow_down", ""))
      }
    }
    const planned = this.cuePlannedSec
    if (!this.oneMinuteSaid && planned > ONE_MINUTE_S && planned - this.cueTotal <= ONE_MINUTE_S && !this._finished) {
      this.oneMinuteSaid = true
      if (this.voice && m.lines["cue_one_minute"]) this.voice.say(lineIdForMode(m, "cue_one_minute", ""))
    }
    if (this.cueCards) this.cueCards.setProgress(this._cueIndex, this.cueCardTime, this.cueTotal)
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
    const want = this.deckCards.length > 0 && atSpot
    if (want && !this.cueCards.isShown) {
      this.cueCards.setProgress(this._cueIndex, this.cueCardTime, this.cueTotal)
      this.cueCards.show()
    } else if (!want && this.cueCards.isShown) {
      this.cueCards.hide()
    }
    if (want) this.tickTalk(getDeltaTime(), this.deckCards)
    this.placeList(want)
  }
}
