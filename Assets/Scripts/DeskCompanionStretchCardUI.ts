/**
 * DeskCompanionStretchCardUI — the card beside Yori during a stretch break: the move name
 * (English big, Japanese small), a big 1–2–3–4 count, and a remaining-time bar.
 *
 * Owns: layout and show/hide only (a passive view). Placement/facing is done by
 * DeskCompanionBillboard on the same SceneObject (beside her, inside the view).
 * Public API: showMove(en, ja, step, steps), setCount(n, of), setRemaining(ratio, seconds), hide(),
 *   isShown, currentEn, currentCount.
 * Must not: run the routine or keep time (DeskCompanionStretch does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Count" | "Title" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Count: {size: 160, weight: 700}, Title: {size: 74, weight: 700}, Caption: {size: 52, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
/** The card floats beside her at her resting spot, ~2.5 m from the user. */
const VIEW_DISTANCE_CM = 250
const BAR_CELLS = 16

@component
export class DeskCompanionStretchCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionStretchCardUI – move name, 1–2–3–4 count, time bar</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(20, 60, 1))
  @hint("Card width (cm)")
  cardWidthCm: number = 56

  @input("vec4", "{1, 0.9, 0.5, 1}")
  @widget(new ColorWidget())
  @hint("Count color")
  countColor: vec4
  @ui.group_end

  private panel: SceneObject
  private header: Text
  private en: Text
  private ja: Text
  private count: Text
  private bar: Text
  private wantVisible = false
  private initialized = false
  private cancel: CancelFunction | null = null
  private _count = 0

  public get isShown(): boolean { return this.wantVisible }
  public get currentEn(): string { return this.wantVisible && this.en ? this.en.text : "" }
  public get currentCount(): number { return this._count }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("StretchPanel")
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
    flex.rowGap = 0.4
    flex.paddingLeft = 1.6
    flex.paddingRight = 1.6
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.2
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const w = this.cardWidthCm - 3.2
    // sized to read from ~2.5 m
    const header = this.addText(content, "StretchHeader", "Caption", w, 3.2, new vec4(0.8, 0.8, 0.8, 1))
    const en = this.addText(content, "StretchMoveEn", "Title", w, 4.8, new vec4(1, 1, 1, 1))
    const ja = this.addText(content, "StretchMoveJa", "Caption", w, 3.2, new vec4(0.85, 0.85, 0.85, 1))
    const count = this.addText(content, "StretchCount", "Count", w, 9.5, this.countColor)
    const bar = this.addText(content, "StretchBar", "Caption", w, 3.2, new vec4(0.45, 0.95, 0.5, 1))
    this.header = header.text
    this.en = en.text
    this.ja = ja.text
    this.count = count.text
    this.bar = bar.text
    flex.addItems([header.item, en.item, ja.item, count.item, bar.item])
    plate.onInitialized.add(() => {
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    })
  }

  /** Show a move: "Stretch 2 / 4", the move name, and reset the count. */
  public showMove(en: string, ja: string, step: number, steps: number): void {
    if (this.header) this.header.text = "Stretch " + (step + 1) + " / " + steps + " · ストレッチ"
    if (this.en) this.en.text = en
    if (this.ja) this.ja.text = ja
    this.setCount(0, 4)
    if (!this.wantVisible) {
      this.wantVisible = true
      if (this.initialized) this.pop(true)
    }
  }

  /** The big count: "2" with the others small ("1 · 2 · 3 · 4" style, current one highlighted by size). */
  public setCount(n: number, of: number): void {
    this._count = n
    if (this.count) this.count.text = n > 0 ? "" + n + " / " + of : "Ready…"
  }

  /** Remaining time for the move: bar + seconds. */
  public setRemaining(ratio: number, seconds: number): void {
    if (!this.bar) return
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(ratio * BAR_CELLS)))
    let b = ""
    for (let i = 0; i < BAR_CELLS; i++) b += i < filled ? "■" : "□"
    this.bar.text = b + "  " + Math.max(0, Math.ceil(seconds)) + " s"
  }

  public hide(): void {
    if (!this.wantVisible) return
    this.wantVisible = false
    this._count = 0
    if (this.initialized) this.pop(false)
  }

  private pop(show: boolean): void {
    if (this.cancel) this.cancel()
    const tr = this.panel.getTransform()
    if (show) {
      this.panel.enabled = true
      this.cancel = animate({duration: 0.25, easing: "ease-out-back", update: (t: number) => {
        const s = 0.75 + 0.25 * t
        tr.setLocalScale(new vec3(s, s, s))
      }})
    } else {
      if (!this.panel.enabled) return
      this.cancel = animate({duration: 0.2, easing: "ease-in-out-quad", update: (t: number) => {
        const s = 1 - 0.25 * t
        tr.setLocalScale(new vec3(s, s, s))
      }, ended: () => {
        if (!this.wantVisible) this.panel.enabled = false
        tr.setLocalScale(vec3.one())
      }})
    }
  }

  private addText(parent: SceneObject, name: string, role: TextRole, w: number, h: number, color: vec4): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const t = so.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = ""
    t.depthTest = true
    applyTextRole(t, role, VIEW_DISTANCE_CM)
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    item.alignSelf = FlexAlignSelf.Stretch
    return {text: t, item}
  }
}
