/**
 * DeskCompanionAskCardUI — the small light card she shows beside her head when you press "Ask":
 * a glyph (☀ weather / ★ plan / → project), the short answer, and a clearly visible
 * "sample data" label (the preview uses prepared answers; live data is future work).
 *
 * Owns: card layout and show/hide only (a passive view). Placement/facing: DeskCompanionBillboard
 * on the same SceneObject (follows her, upper-left of her head, opposite the speech bubble).
 * Public API: showCard(glyph, text), hide(), isShown, currentText.
 * Must not: decide which answer comes next or when it hides (DeskCompanionModeController does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Headline1" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700}, Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font

/** Read from ~1.2 m (she is up close when you can press Ask); the billboard grows it when farther. */
const VIEW_DISTANCE_CM = 120

@component
export class DeskCompanionAskCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionAskCardUI – answer card beside her (sample data)</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(10, 40, 0.5))
  @hint("Card width (cm)")
  cardWidthCm: number = 20

  @input
  @widget(new SliderWidget(5, 20, 0.5))
  @hint("Card height (cm)")
  cardHeightCm: number = 10

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Answer text color (keep light: the display is additive)")
  textColor: vec4

  @input
  @hint("Label that marks the answers as prepared sample data")
  sampleLabel: string = "sample data · サンプル"
  @ui.group_end

  private panel: SceneObject
  private glyph: Text
  private body: Text
  private wantVisible = false
  private initialized = false
  private cancel: CancelFunction | null = null

  public get isShown(): boolean { return this.wantVisible }
  public get currentText(): string { return this.wantVisible && this.body ? this.body.text : "" }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("AskCardPanel")
    this.panel.setParent(this.getSceneObject())
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    plate.size = new vec2(this.cardWidthCm, this.cardHeightCm)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = this.cardWidthCm
    flex.height = this.cardHeightCm
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.3
    flex.paddingLeft = 1
    flex.paddingRight = 1
    flex.paddingTop = 0.6
    flex.paddingBottom = 0.6

    const innerW = this.cardWidthCm - 2
    const labelH = 1.4
    const mainH = this.cardHeightCm - 1.2 - 0.3 - labelH

    // Row: glyph + answer text
    const row = global.scene.createSceneObject("AskRow")
    row.setParent(content)
    row.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const rf = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rf.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    rf.direction = FlexDirection.Row
    rf.justifyContent = FlexJustify.Start
    rf.alignItems = FlexAlign.Center
    rf.columnGap = 0.6
    rf.width = -1
    rf.height = mainH
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideHeight = mainH
    rowItem.alignSelf = FlexAlignSelf.Stretch
    const glyphW = 2.6
    const g = this.addText(row, "AskGlyph", "Headline1", glyphW, mainH, new vec4(1, 0.88, 0.45, 1), HorizontalAlignment.Center)
    const b = this.addText(row, "AskText", "Body", innerW - glyphW - 0.6, mainH, this.textColor, HorizontalAlignment.Left)
    this.glyph = g.text
    this.body = b.text
    this.body.horizontalOverflow = HorizontalOverflow.Wrap
    this.body.verticalOverflow = VerticalOverflow.Shrink
    rf.addItems([g.item, b.item])

    const label = this.addText(content, "AskSampleLabel", "Caption", innerW, labelH, new vec4(1, 0.9, 0.5, 0.9), HorizontalAlignment.Right)
    label.text.text = this.sampleLabel
    flex.addItems([rowItem, label.item])

    plate.onInitialized.add(() => {
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    })
  }

  /** Show an answer card (replaces the previous one). */
  public showCard(glyph: string, text: string): void {
    if (this.glyph) this.glyph.text = glyph
    if (this.body) this.body.text = text
    this.wantVisible = true
    if (this.initialized) this.pop(true)
  }

  public hide(): void {
    if (!this.wantVisible) return
    this.wantVisible = false
    if (this.initialized) this.pop(false)
  }

  private pop(show: boolean): void {
    if (this.cancel) this.cancel()
    const tr = this.panel.getTransform()
    if (show) {
      this.panel.enabled = true
      this.cancel = animate({
        duration: 0.2,
        easing: "ease-out-back",
        update: (t: number) => {
          const s = 0.8 + 0.2 * t
          tr.setLocalScale(new vec3(s, s, s))
        }
      })
    } else {
      if (!this.panel.enabled) return
      this.cancel = animate({
        duration: 0.25,
        easing: "ease-in-out-quad",
        update: (t: number) => {
          const s = 1 - 0.25 * t
          tr.setLocalScale(new vec3(s, s, s))
        },
        ended: () => {
          if (!this.wantVisible) this.panel.enabled = false
          tr.setLocalScale(vec3.one())
        }
      })
    }
  }

  private addText(parent: SceneObject, name: string, role: TextRole, w: number, h: number, color: vec4,
    align: HorizontalAlignment): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const t = so.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = ""
    t.depthTest = true
    applyTextRole(t, role, VIEW_DISTANCE_CM)
    t.textFill.color = color
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    return {text: t, item}
  }
}
