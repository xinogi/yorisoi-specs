/**
 * DeskCompanionTranslateCardUI — the card beside her head for free-text translation ("Translate…"):
 * a tiny source label ("live" / "offline"), the original text, the English translation (large),
 * and the third language (small). Each row uses the right font for its script (Korean needs the
 * Korean font; Japanese and Latin use the Japanese font).
 *
 * Owns: card layout and show/hide only (a passive view). Placement/facing: DeskCompanionBillboard
 * on the same SceneObject (upper-left of her head, opposite the speech bubble).
 * Public API: showTranslation(original, originalScript, english, other, otherScript, label), hide(),
 *             isShown, currentEnglish.
 * Must not: call the translation service (DeskCompanionTranslator does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Headline2" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700}, Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
const FONT_KO = requireAsset("../Fonts/NotoSansKR-Medium.ttf") as Font

const VIEW_DISTANCE_CM = 120

export type ScriptKind = "en" | "ja" | "ko"

@component
export class DeskCompanionTranslateCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionTranslateCardUI – free-text translation card</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(14, 40, 0.5))
  @hint("Card width (cm)")
  cardWidthCm: number = 22

  @input
  @widget(new SliderWidget(8, 24, 0.5))
  @hint("Card height (cm)")
  cardHeightCm: number = 13

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("English (large) text color — keep light: the display is additive")
  englishColor: vec4
  @ui.group_end

  private panel: SceneObject
  private label: Text
  private original: Text
  private english: Text
  private other: Text
  private wantVisible = false
  private initialized = false
  private cancel: CancelFunction | null = null

  public get isShown(): boolean { return this.wantVisible }
  public get currentEnglish(): string { return this.wantVisible && this.english ? this.english.text : "" }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("TranslateCardPanel")
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
    flex.rowGap = 0.25
    flex.paddingLeft = 1
    flex.paddingRight = 1
    flex.paddingTop = 0.6
    flex.paddingBottom = 0.6

    const w = this.cardWidthCm - 2
    const inner = this.cardHeightCm - 1.2 - 0.75
    const labelH = 1.2
    const rest = inner - labelH
    const origH = rest * 0.27
    const enH = rest * 0.43
    const otherH = rest - origH - enH
    const l = this.addText(content, "TranslateLabel", "Caption", w, labelH, new vec4(1, 0.9, 0.5, 0.9), HorizontalAlignment.Right)
    const o = this.addText(content, "TranslateOriginal", "Body", w, origH, new vec4(0.85, 0.92, 1, 1), HorizontalAlignment.Left)
    const e = this.addText(content, "TranslateEnglish", "Headline2", w, enH, this.englishColor, HorizontalAlignment.Left)
    const x = this.addText(content, "TranslateOther", "Caption", w, otherH, new vec4(0.8, 0.88, 1, 0.95), HorizontalAlignment.Left)
    this.label = l.text
    this.original = o.text
    this.english = e.text
    this.other = x.text
    flex.addItems([l.item, o.item, e.item, x.item])

    plate.onInitialized.add(() => {
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    })
  }

  /** Show a translation: original -> English (large) -> other language (small), with a source label. */
  public showTranslation(original: string, originalScript: ScriptKind, english: string, other: string, otherScript: ScriptKind, label: string): void {
    if (this.original) {
      this.original.font = originalScript === "ko" ? FONT_KO : FONT_JA
      this.original.text = original
    }
    if (this.english) this.english.text = english
    if (this.other) {
      this.other.font = otherScript === "ko" ? FONT_KO : FONT_JA
      this.other.text = other
    }
    if (this.label) this.label.text = label
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
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Shrink
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    item.alignSelf = FlexAlignSelf.Stretch
    return {text: t, item}
  }
}
