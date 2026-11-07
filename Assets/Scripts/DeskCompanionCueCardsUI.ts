/**
 * DeskCompanionCueCardsUI — the cue card ("カンペ") shown right beside her in Cue cards mode:
 * a small "Cue card 2 / 5" header, the talking point in big light text, and big "Back" / "Next"
 * UIKit buttons (SceneObjects "CueBackButton" / "CueNextButton", findable by LEAF).
 *
 * Owns: card layout and show/hide only (a passive view). Placement/facing is done by
 * DeskCompanionBillboard on the same SceneObject (follows her, sits to her left, inside the view
 * and at eye level so it never covers the desk work).
 * Public API: setCard(text, index, count), show(), hide(), isShown, onNext, onBack.
 * Must not: decide which card is next (DeskCompanionModeController does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Headline1" | "Button" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700}, Button: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font

/** The card floats next to her resting spot, ~2.5 m from the user. */
const VIEW_DISTANCE_CM = 250
const BUTTON_LABEL_Z = 0.08

@component
export class DeskCompanionCueCardsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionCueCardsUI – cue card beside her with Back / Next</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(30, 90, 1))
  @hint("Card width (cm) — read from ~2.5 m")
  cardWidthCm: number = 60

  @input
  @widget(new SliderWidget(15, 50, 0.5))
  @hint("Card height (cm)")
  cardHeightCm: number = 26

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Talking-point text color (keep light: the display is additive)")
  textColor: vec4

  @input
  @hint("Back button label")
  backLabel: string = "◀ Back"

  @input
  @hint("Next button label")
  nextLabel: string = "Next ▶"
  @ui.group_end

  private panel: SceneObject
  private header: Text
  private body: Text
  private wantVisible = false
  private pendingInits = 3
  private initialized = false
  private cancel: CancelFunction | null = null
  private _onNext = new Event<void>()
  private _onBack = new Event<void>()

  get onNext(): PublicApi<void> { return this._onNext.publicApi() }
  get onBack(): PublicApi<void> { return this._onBack.publicApi() }
  public get isShown(): boolean { return this.wantVisible }
  /** Text currently on the card. */
  public get currentText(): string { return this.body ? this.body.text : "" }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("CueCardPanel")
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
    flex.rowGap = 0.8
    flex.paddingLeft = 2
    flex.paddingRight = 2
    flex.paddingTop = 1.5
    flex.paddingBottom = 1.5

    const innerW = this.cardWidthCm - 4
    const headerH = 2.6
    const buttonsH = 7.5
    const bodyH = this.cardHeightCm - 3 - 1.6 - headerH - buttonsH
    const header = this.addText(content, "CueHeader", "Caption", innerW, headerH, new vec4(1, 0.9, 0.5, 1), HorizontalAlignment.Left)
    const body = this.addText(content, "CueText", "Headline1", innerW, bodyH, this.textColor, HorizontalAlignment.Left)
    this.header = header.text
    this.body = body.text
    this.body.horizontalOverflow = HorizontalOverflow.Wrap
    this.body.verticalOverflow = VerticalOverflow.Shrink

    // Buttons row
    const row = global.scene.createSceneObject("CueButtons")
    row.setParent(content)
    row.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const rf = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rf.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    rf.direction = FlexDirection.Row
    rf.justifyContent = FlexJustify.SpaceBetween
    rf.alignItems = FlexAlign.Center
    rf.width = -1
    rf.height = buttonsH
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideHeight = buttonsH
    rowItem.alignSelf = FlexAlignSelf.Stretch
    const back = this.addButton(row, "CueBackButton", this.backLabel, () => this._onBack.invoke())
    const next = this.addButton(row, "CueNextButton", this.nextLabel, () => this._onNext.invoke())
    rf.addItems([back.item, next.item])

    flex.addItems([header.item, body.item, rowItem])

    const done = () => {
      this.pendingInits--
      if (this.pendingInits > 0) return
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    }
    plate.onInitialized.add(done)
    back.button.onInitialized.add(done)
    next.button.onInitialized.add(done)
  }

  /** Put a talking point on the card ("Cue card i+1 / count"). */
  public setCard(text: string, index: number, count: number): void {
    if (this.body) this.body.text = text
    if (this.header) this.header.text = "Cue card " + (index + 1) + " / " + count + " · カンペ"
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
        duration: 0.2,
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
    item.alignSelf = FlexAlignSelf.Stretch
    return {text: t, item}
  }

  private addButton(parent: SceneObject, name: string, label: string, onTap: () => void): {button: Button; item: FlexItem} {
    const w = 17
    const h = 7
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
    return {button: btn, item}
  }
}
