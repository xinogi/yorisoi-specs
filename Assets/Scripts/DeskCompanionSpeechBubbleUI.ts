/**
 * DeskCompanionSpeechBubbleUI — the speech bubble beside her head: Japanese line on top,
 * English line below, light text on a UIKit BackPlate. Pops in when she speaks; the voice
 * script hides it a few seconds after she finishes.
 *
 * Owns: bubble layout and show/hide animation only (a passive view).
 * Public API: showLine(ja, en), hide(), isShown, currentJa, currentEn.
 * Placement/facing is done by DeskCompanionBillboard on the same SceneObject.
 * Must not: decide what she says or when (DeskCompanionVoice does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

// ── Typography (see DeskCompanionForeignPageUI for the rationale) ──
const FONT_SIZE_SCALE = 0.95
type TextRole = "Headline2" | "Subheadline" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font

/** Distance the bubble is designed to be read from (she stands ~1.2 m away; billboard scales it up when farther). */
const READ_DISTANCE_CM = 120

@component
export class DeskCompanionSpeechBubbleUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionSpeechBubbleUI – subtitles beside her head</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(14, 40, 0.5))
  @hint("Bubble width (cm)")
  widthCm: number = 24

  @input
  @widget(new SliderWidget(6, 20, 0.5))
  @hint("Bubble height (cm) — room for ~3 lines of Japanese and ~3 lines of English")
  heightCm: number = 12.5

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Japanese subtitle color (keep light: the display is additive)")
  jaColor: vec4

  @input("vec4", "{0.78, 0.88, 1, 0.95}")
  @widget(new ColorWidget())
  @hint("English subtitle color")
  enColor: vec4
  @ui.group_end

  private panel: SceneObject
  private jaText: Text
  private enText: Text
  private wantVisible = false
  private initialized = false
  private cancel: CancelFunction | null = null
  private _ja = ""
  private _en = ""

  public get isShown(): boolean { return this.wantVisible }
  public get currentJa(): string { return this.wantVisible ? this._ja : "" }
  public get currentEn(): string { return this.wantVisible ? this._en : "" }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("BubblePanel")
    this.panel.setParent(this.getSceneObject())
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    plate.size = new vec2(this.widthCm, this.heightCm)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = this.widthCm
    flex.height = this.heightCm
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.5
    flex.paddingLeft = 1.2
    flex.paddingRight = 1.2
    flex.paddingTop = 0.8
    flex.paddingBottom = 0.8

    const innerW = this.widthCm - 2.4
    const innerH = this.heightCm - 1.6 - 0.5
    const jaH = innerH * 0.55
    const enH = innerH - jaH
    const ja = this.addWrappedText(content, "Ja", "Body", innerW, jaH, this.jaColor)
    const en = this.addWrappedText(content, "En", "Caption", innerW, enH, this.enColor)
    this.jaText = ja.text
    this.enText = en.text
    flex.addItems([ja.item, en.item])

    // Start hidden — disable only at the tail of the BackPlate's own init.
    plate.onInitialized.add(() => {
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false
    })
  }

  /** Show a line (Japanese + English). Replaces whatever is showing. */
  public showLine(ja: string, en: string): void {
    this._ja = ja
    this._en = en
    if (this.jaText) this.jaText.text = ja
    if (this.enText) this.enText.text = en
    this.wantVisible = true
    if (this.initialized) this.pop(true)
  }

  /** Fade the bubble out. */
  public hide(): void {
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
        duration: 0.35,
        easing: "ease-in-out-quad",
        update: (t: number) => {
          const s = 1 - 0.25 * t
          tr.setLocalScale(new vec3(s, s, s))
          this.setAlpha(1 - t)
        },
        ended: () => {
          if (!this.wantVisible) this.panel.enabled = false
          tr.setLocalScale(vec3.one())
          this.setAlpha(1)
        }
      })
    }
  }

  private setAlpha(a: number): void {
    if (this.jaText) this.jaText.textFill.color = new vec4(this.jaColor.x, this.jaColor.y, this.jaColor.z, this.jaColor.w * a)
    if (this.enText) this.enText.textFill.color = new vec4(this.enColor.x, this.enColor.y, this.enColor.z, this.enColor.w * a)
  }

  private addWrappedText(parent: SceneObject, name: string, role: TextRole, w: number, h: number, color: vec4): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const t = so.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = ""
    t.depthTest = true
    applyTextRole(t, role, READ_DISTANCE_CM)
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Left
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
