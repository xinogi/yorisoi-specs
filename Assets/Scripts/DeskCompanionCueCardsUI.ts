/**
 * DeskCompanionCueCardsUI — the TALK LIST ("カンペ") that stays beside her in Cue cards mode.
 * Only the wearer sees it (it lives in the glasses), so it can carry the whole talk.
 *
 * Owns: layout and show/hide only (a passive view). Every item of the current deck is listed:
 *   - finished items dimmed, upcoming items normal, the current item large and bright with its
 *     delivery note ("話し方", accent color), its detail bullets, and a time bar
 *     (green -> amber -> red against the item's target seconds);
 *   - a header with the deck name and the total elapsed time ("1:02 / 2:15");
 *   - every row is a UIKit Ghost button: pinch an item to jump to it ("CueRow_<slot>");
 *   - buttons: Back / Auto / Rehearse / Next, and Deck ▶ / −5s / +5s / ▲ / ▼ for the current item
 *     ("CueBackButton", "CueAutoButton", "CueRehearseButton", "CueNextButton", "CueDeckButton",
 *     "CueMinus5Button", "CuePlus5Button", "CueUpButton", "CueDownButton", plus "CueSmallerButton" /
 *     "CueBiggerButton" (A− / A+ scale the whole list 0.7–1.6×, session-only) — findable by LEAF).
 *   Long decks scroll: at most `maxVisibleItems` rows are shown, kept around the current item.
 * Placement/facing is done by DeskCompanionBillboard on the same SceneObject (beside her, eye
 * height, inside the narrow view, never over the desk work).
 * Public API: setDeck(cards, name), setProgress(index, cardElapsed, totalElapsed), setAuto(on),
 *   show(), hide(), isShown, events onNext / onBack / onAutoToggle / onRehearse / onDeck,
 *   onJump(index), onAdjust(deltaSeconds), onMove(direction), and read-only test getters.
 * Must not: decide which item is current, keep time or edit the deck (DeskCompanionModeController does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {CueCard, PERSONA_MODES} from "./DeskCompanionPersonaData"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Title" | "Body" | "Button" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title: {size: 52, weight: 700}, Body: {size: 41, weight: 500}, Button: {size: 42, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font

/** The list floats next to her resting spot, ~2.5 m from the user. */
const VIEW_DISTANCE_CM = 250
const LABEL_Z = 0.5
const BUTTON_LABEL_Z = 0.08
/** Row heights (cm). The current row grows to fit its text, note, details and time bar. */
const ROW_H = 3.4
const CURRENT_TEXT_H = 11
const NOTE_H = 3.0
const DETAIL_LINE_H = 2.7
const BAR_H = 3.0
const HEADER_H = 3.4
const BUTTONS_H = 7
const BAR_CELLS = 20

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ":" + (r < 10 ? "0" : "") + r
}

interface Row {
  so: SceneObject
  item: FlexItem
  layout: FlexLayout
  button: Button
  text: Text
  textItem: FlexItem
  note: Text
  noteItem: FlexItem
  details: Text
  detailsItem: FlexItem
  bar: Text
  barItem: FlexItem
}

@component
export class DeskCompanionCueCardsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionCueCardsUI – talk list beside her (decks, jump, timing, order)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(40, 100, 1))
  @hint("List width (cm) — read from ~2.5 m")
  cardWidthCm: number = 72

  @input
  @widget(new SliderWidget(3, 12, 1))
  @hint("Rows shown at once; longer decks scroll to keep the current item in view")
  maxVisibleItems: number = 7

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Current item text color (keep light: the display is additive)")
  textColor: vec4

  @input("vec4", "{0.45, 0.85, 1, 1}")
  @widget(new ColorWidget())
  @hint("Delivery note (話し方) and detail bullets color")
  noteColor: vec4

  @input
  @hint("Back button label")
  backLabel: string = "◀ Back"

  @input
  @hint("Next button label")
  nextLabel: string = "Next ▶"
  @ui.group_end

  private panel: SceneObject
  private title: Text
  private timer: Text
  private rows: Row[] = []
  private autoText: Text | null = null
  private deck: CueCard[] = []
  private _deckName = ""
  private plannedTotal = 0
  private _index = 0
  private windowStart = 0
  private lastBarKey = ""
  private lastTimerKey = ""
  private wantVisible = false
  private pendingInits = 12
  private initialized = false
  private cancel: CancelFunction | null = null
  private _onNext = new Event<void>()
  private _onBack = new Event<void>()
  private _onAutoToggle = new Event<void>()
  private _onRehearse = new Event<void>()
  private _onDeck = new Event<void>()
  private _onJump = new Event<number>()
  private _onAdjust = new Event<number>()
  private _onMove = new Event<number>()
  private _scale = 1

  /** Current list size (A− / A+). */
  public get cueScale(): number { return this._scale }

  /** Set the list size (clamped to 0.7–1.6). */
  public setScale(v: number): void {
    this._scale = Math.max(0.7, Math.min(1.6, Math.round(v * 100) / 100))
    if (this.panel && this.panel.enabled && !this.cancel) this.panel.getTransform().setLocalScale(vec3.one().uniformScale(this._scale))
    else if (this.panel && this.panel.enabled) this.panel.getTransform().setLocalScale(vec3.one().uniformScale(this._scale))
  }

  get onNext(): PublicApi<void> { return this._onNext.publicApi() }
  get onBack(): PublicApi<void> { return this._onBack.publicApi() }
  get onAutoToggle(): PublicApi<void> { return this._onAutoToggle.publicApi() }
  get onRehearse(): PublicApi<void> { return this._onRehearse.publicApi() }
  /** "Deck ▶" pinched. */
  get onDeck(): PublicApi<void> { return this._onDeck.publicApi() }
  /** An item was pinched: its index in the deck. */
  get onJump(): PublicApi<number> { return this._onJump.publicApi() }
  /** −5s / +5s pinched: the change in seconds for the current item. */
  get onAdjust(): PublicApi<number> { return this._onAdjust.publicApi() }
  /** ▲ / ▼ pinched: -1 = move the current item up, +1 = down. */
  get onMove(): PublicApi<number> { return this._onMove.publicApi() }
  public get isShown(): boolean { return this.wantVisible }
  /** Highlighted item index. */
  public get currentIndex(): number { return this._index }
  /** Text of the highlighted item. */
  public get currentText(): string { return this.deck[this._index] ? this.deck[this._index].text : "" }
  /** Delivery note shown under the highlighted item. */
  public get currentNote(): string { return this.deck[this._index] ? this.deck[this._index].note : "" }
  /** The time bar text under the highlighted item ("■■■□□ 0:12 / 0:20"). */
  public get barText(): string { return this.lastBarKey }
  /** Total timer in the header ("Total 1:02 / 2:15"). */
  public get timerText(): string { return this.timer ? this.timer.text : "" }
  /** Number of list rows in use (deck length, capped by maxVisibleItems). */
  public get rowCount(): number { return Math.min(this.deck.length, this.rows.length) }
  /** Label on the Auto toggle. */
  public get autoLabel(): string { return this.autoText ? this.autoText.text : "" }
  /** Deck name shown in the header. */
  public get deckName(): string { return this._deckName }
  /** Deck index of the item shown in row `slot` (-1 if the row is empty). */
  public rowCardIndex(slot: number): number {
    const i = this.windowStart + slot
    return slot >= 0 && slot < this.rows.length && i < this.deck.length ? i : -1
  }

  onAwake(): void {
    // enough rows for the longest deck in persona/modes.md (capped; longer decks scroll)
    let longest = 1
    for (const m of PERSONA_MODES) {
      longest = Math.max(longest, m.cueCards.length)
      for (const d of m.cueDecks || []) longest = Math.max(longest, d.cards.length)
    }
    const slots = Math.max(1, Math.min(longest, Math.round(this.maxVisibleItems)))

    this.panel = global.scene.createSceneObject("CueListPanel")
    this.panel.setParent(this.getSceneObject())
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = this.cardWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.6
    flex.paddingLeft = 2
    flex.paddingRight = 2
    flex.paddingTop = 1.5
    flex.paddingBottom = 1.5
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const innerW = this.cardWidthCm - 4

    // Header: deck title (left) + total timer (right)
    const header = this.addRowLayout(content, "CueHeader", HEADER_H, FlexJustify.SpaceBetween)
    const title = this.addText(header.so, "CueTitle", "Caption", innerW * 0.62, HEADER_H, new vec4(1, 0.9, 0.5, 1), HorizontalAlignment.Left)
    this.title = title.text
    this.title.text = "Talk list · カンペ"
    const timer = this.addText(header.so, "CueTimer", "Caption", innerW * 0.38, HEADER_H, new vec4(0.85, 0.85, 0.85, 1), HorizontalAlignment.Right)
    this.timer = timer.text
    header.layout.addItems([title.item, timer.item])

    // List rows (each a Ghost button: pinch to jump)
    const items: FlexItem[] = [header.item]
    for (let i = 0; i < slots; i++) {
      const row = this.addListRow(content, i, innerW)
      this.rows.push(row)
      items.push(row.item)
    }

    // Buttons: talk controls, then deck / current-item edits
    const r1 = this.addRowLayout(content, "CueButtons", BUTTONS_H, FlexJustify.SpaceBetween)
    const bw = (innerW - 3 * 1.0) / 4
    const back = this.addButton(r1.so, "CueBackButton", this.backLabel, bw, () => this._onBack.invoke())
    const auto = this.addButton(r1.so, "CueAutoButton", "Auto: Off", bw, () => this._onAutoToggle.invoke())
    this.autoText = auto.label
    const rehearse = this.addButton(r1.so, "CueRehearseButton", "Rehearse", bw, () => this._onRehearse.invoke())
    const next = this.addButton(r1.so, "CueNextButton", this.nextLabel, bw, () => this._onNext.invoke())
    r1.layout.addItems([back.item, auto.item, rehearse.item, next.item])
    items.push(r1.item)

    const r2 = this.addRowLayout(content, "CueEditButtons", BUTTONS_H, FlexJustify.SpaceBetween)
    const deckW = innerW * 0.22
    const sw = (innerW - deckW - 6 * 1.0) / 6
    const deck = this.addButton(r2.so, "CueDeckButton", "Deck ▶", deckW, () => this._onDeck.invoke())
    const minus = this.addButton(r2.so, "CueMinus5Button", "−5s", sw, () => this._onAdjust.invoke(-5))
    const plus = this.addButton(r2.so, "CuePlus5Button", "+5s", sw, () => this._onAdjust.invoke(5))
    const up = this.addButton(r2.so, "CueUpButton", "▲", sw, () => this._onMove.invoke(-1))
    const down = this.addButton(r2.so, "CueDownButton", "▼", sw, () => this._onMove.invoke(1))
    const smaller = this.addButton(r2.so, "CueSmallerButton", "A−", sw, () => this.setScale(this._scale - 0.15))
    const bigger = this.addButton(r2.so, "CueBiggerButton", "A+", sw, () => this.setScale(this._scale + 0.15))
    r2.layout.addItems([deck.item, minus.item, plus.item, up.item, down.item, smaller.item, bigger.item])
    items.push(r2.item)

    flex.addItems(items)

    const done = () => {
      this.pendingInits--
      if (this.pendingInits > 0) return
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    }
    plate.onInitialized.add(done)
    for (const b of [back, auto, rehearse, next, deck, minus, plus, up, down, smaller, bigger]) b.button.onInitialized.add(done)
  }

  /** Load a deck (all items are listed). Keeps the highlight index if it is still valid. */
  public setDeck(cards: CueCard[], name: string = ""): void {
    this.deck = cards.slice()
    this._deckName = name
    if (this.title) this.title.text = "Talk list · " + (name || "カンペ")
    this.plannedTotal = 0
    for (const c of this.deck) this.plannedTotal += Math.max(0, c.seconds || 0)
    this._index = Math.min(this._index, Math.max(0, this.deck.length - 1))
    this.lastTimerKey = ""
    this.refreshRows()
  }

  /** Highlight item `index` and update its time bar and the total timer. */
  public setProgress(index: number, cardElapsed: number, totalElapsed: number): void {
    const idx = Math.max(0, Math.min(index, this.deck.length - 1))
    if (idx !== this._index) {
      this._index = idx
      this.refreshRows()
    }
    this.updateBar(cardElapsed)
    const timerKey = "Total " + mmss(totalElapsed) + (this.plannedTotal > 0 ? " / " + mmss(this.plannedTotal) : "")
    if (timerKey !== this.lastTimerKey && this.timer) {
      this.lastTimerKey = timerKey
      this.timer.text = timerKey
    }
  }

  /** Show the Auto toggle state. */
  public setAuto(on: boolean): void {
    if (this.autoText) this.autoText.text = on ? "Auto: On" : "Auto: Off"
  }

  public show(): void {
    if (this.wantVisible) return
    this.wantVisible = true
    if (this.initialized) this.pop(true)
  }

  public hide(): void {
    if (!this.wantVisible) return
    this.wantVisible = false
    if (this.initialized) this.pop(false)
  }

  // ───────────────────────────── list rendering ─────────────────────────────

  private refreshRows(): void {
    const n = this.deck.length
    const slots = this.rows.length
    // scroll window: keep two finished items above the current one when the deck is long
    let start = 0
    if (n > slots) start = Math.max(0, Math.min(this._index - 2, n - slots))
    this.windowStart = start
    const w = this.cardWidthCm - 4
    for (let s = 0; s < slots; s++) {
      const row = this.rows[s]
      const i = start + s
      const card = i < n ? this.deck[i] : null
      const isCurrent = i === this._index && !!card
      const isDone = i < this._index
      row.text.text = card ? (isCurrent ? "▶ " : (i + 1) + ". ") + card.text : ""
      applyTextRole(row.text, isCurrent ? "Title" : "Body", VIEW_DISTANCE_CM)
      row.text.horizontalOverflow = isCurrent ? HorizontalOverflow.Wrap : HorizontalOverflow.Truncate
      row.text.verticalOverflow = isCurrent ? VerticalOverflow.Shrink : VerticalOverflow.Truncate
      row.text.textFill.color = isCurrent ? this.textColor : isDone ? new vec4(0.55, 0.55, 0.55, 1) : new vec4(0.88, 0.88, 0.88, 1)
      const textH = isCurrent ? CURRENT_TEXT_H : ROW_H
      this.setTextHeight(row.text, row.textItem, textH)
      const noteH = isCurrent && card.note ? NOTE_H : 0
      row.note.text = noteH > 0 ? "話し方: " + card.note : ""
      this.setTextHeight(row.note, row.noteItem, noteH)
      const det = isCurrent && card.details ? card.details.filter((d) => d.length > 0) : []
      const detH = det.length * DETAIL_LINE_H
      row.details.text = det.map((d) => "• " + d).join("\n")
      this.setTextHeight(row.details, row.detailsItem, detH)
      const barH = isCurrent && card.seconds > 0 ? BAR_H : 0
      if (barH === 0) row.bar.text = ""
      this.setTextHeight(row.bar, row.barItem, barH)
      const total = card ? textH + noteH + detH + barH : 0.01
      row.layout.height = total
      row.item.overrideHeight = total
      row.button.size = new vec3(w, Math.max(0.01, total), 0.4)
      row.so.enabled = !!card
    }
    this.lastBarKey = ""
  }

  private updateBar(cardElapsed: number): void {
    const slot = this._index - this.windowStart
    if (slot < 0 || slot >= this.rows.length) return
    const card = this.deck[this._index]
    const row = this.rows[slot]
    if (!card || !(card.seconds > 0)) return
    const ratio = cardElapsed / card.seconds
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(Math.min(1, ratio) * BAR_CELLS)))
    let bar = ""
    for (let i = 0; i < BAR_CELLS; i++) bar += i < filled ? "■" : "□"
    const key = bar + "  " + mmss(cardElapsed) + " / " + mmss(card.seconds)
    if (key === this.lastBarKey) return
    this.lastBarKey = key
    row.bar.text = key
    // green -> amber -> red against the item's target seconds
    row.bar.textFill.color = ratio < 0.7 ? new vec4(0.45, 0.95, 0.5, 1) : ratio <= 1 ? new vec4(1, 0.78, 0.3, 1) : new vec4(1, 0.4, 0.35, 1)
  }

  private setTextHeight(t: Text, item: FlexItem, h: number): void {
    item.overrideHeight = h
    const w = this.cardWidthCm - 4
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  }

  // ───────────────────────────── building blocks ─────────────────────────────

  private pop(show: boolean): void {
    if (this.cancel) this.cancel()
    const tr = this.panel.getTransform()
    if (show) {
      this.panel.enabled = true
      this.cancel = animate({
        duration: 0.25,
        easing: "ease-out-back",
        update: (t: number) => {
          const s = (0.75 + 0.25 * t) * this._scale
          tr.setLocalScale(new vec3(s, s, s))
        },
        ended: () => {
          this.cancel = null
        }
      })
    } else {
      if (!this.panel.enabled) return
      this.cancel = animate({
        duration: 0.2,
        easing: "ease-in-out-quad",
        update: (t: number) => {
          const s = (1 - 0.25 * t) * this._scale
          tr.setLocalScale(new vec3(s, s, s))
        },
        ended: () => {
          this.cancel = null
          if (!this.wantVisible) this.panel.enabled = false
          tr.setLocalScale(vec3.one().uniformScale(this._scale))
        }
      })
    }
  }

  private addRowLayout(parent: SceneObject, name: string, h: number, justify: FlexJustify): {so: SceneObject; layout: FlexLayout; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const layout = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    layout.direction = FlexDirection.Row
    layout.justifyContent = justify
    layout.alignItems = FlexAlign.Center
    layout.width = -1
    layout.height = h
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = h
    item.alignSelf = FlexAlignSelf.Stretch
    return {so, layout, item}
  }

  /** One list row (a Ghost button): item text, then (current row only) note, details and time bar. */
  private addListRow(parent: SceneObject, slot: number, w: number): Row {
    const so = global.scene.createSceneObject("CueRow_" + slot)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const button = so.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS2", shape: "Rectangle", style: "Ghost"})
    button.size = new vec3(w, ROW_H, 0.4)
    button.onTriggerUp.add(() => {
      const i = this.rowCardIndex(slot)
      if (i >= 0) this._onJump.invoke(i)
    })
    const layout = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    layout.direction = FlexDirection.Column
    layout.justifyContent = FlexJustify.Start
    layout.alignItems = FlexAlign.Stretch
    layout.width = w
    layout.height = ROW_H
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = ROW_H
    item.alignSelf = FlexAlignSelf.Stretch
    const text = this.addText(so, "CueItem", "Body", w, ROW_H, new vec4(0.88, 0.88, 0.88, 1), HorizontalAlignment.Left, LABEL_Z)
    const note = this.addText(so, "CueNote", "Caption", w, 0, this.noteColor, HorizontalAlignment.Left, LABEL_Z)
    const details = this.addText(so, "CueDetails", "Caption", w, 0, this.noteColor, HorizontalAlignment.Left, LABEL_Z)
    details.text.verticalOverflow = VerticalOverflow.Overflow
    details.text.verticalAlignment = VerticalAlignment.Top
    const bar = this.addText(so, "CueBar", "Caption", w, 0, new vec4(0.45, 0.95, 0.5, 1), HorizontalAlignment.Left, LABEL_Z)
    layout.addItems([text.item, note.item, details.item, bar.item])
    return {so, item, layout, button, text: text.text, textItem: text.item, note: note.text, noteItem: note.item,
      details: details.text, detailsItem: details.item, bar: bar.text, barItem: bar.item}
  }

  private addText(parent: SceneObject, name: string, role: TextRole, w: number, h: number, color: vec4,
    align: HorizontalAlignment, z: number = 0.02): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, z))
    const t = so.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = ""
    t.depthTest = true
    applyTextRole(t, role, VIEW_DISTANCE_CM)
    t.textFill.color = color
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Truncate
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    return {text: t, item}
  }

  private addButton(parent: SceneObject, name: string, label: string, w: number, onTap: () => void): {button: Button; item: FlexItem; label: Text} {
    const h = BUTTONS_H - 0.6
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"})
    btn.size = new vec3(w, h, 1)
    btn.onTriggerUp.add(onTap)
    const labelSO = global.scene.createSceneObject("Label")
    labelSO.setParent(so)
    labelSO.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = labelSO.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = label
    t.depthTest = true
    applyTextRole(t, "Button", VIEW_DISTANCE_CM)
    t.textFill.color = new vec4(1, 0.95, 0.62, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-(w - 1) / 2, (w - 1) / 2, -h / 2, h / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    return {button: btn, item, label: t}
  }
}
