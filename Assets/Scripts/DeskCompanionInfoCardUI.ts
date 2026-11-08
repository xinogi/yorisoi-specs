/**
 * DeskCompanionInfoCardUI — the secretary card beside Yori: the morning briefing (weather, today,
 * reminder) or a running timer (label + big countdown), with one optional shortcut button
 * ("Rehearse" / "Stretch") on SceneObject "InfoShortcutButton" (findable by LEAF).
 *
 * Owns: layout and show/hide only (a passive view).
 * Public API: showLines(title, lines, shortcut), showCountdown(label, seconds), hide(), isShown,
 *   currentTitle, currentText, onShortcut (Event<void>).
 * Must not: fetch weather or keep time (DeskCompanionSecretary does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Count" | "Title" | "Body"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Count: {size: 130, weight: 700}, Title: {size: 56, weight: 700}, Body: {size: 44, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
/** Designed at 1.2 m (she is close after a Call); DeskCompanionBillboard scales it up with distance. */
const VIEW_DISTANCE_CM = 120

@component
export class DeskCompanionInfoCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionInfoCardUI – briefing / timer card beside her</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(30, 80, 1))
  @hint("Card width (cm)")
  cardWidthCm: number = 26
  @ui.group_end

  private panel: SceneObject
  private title: Text
  private body: Text
  private count: Text
  private bodyItem: FlexItem
  private countItem: FlexItem
  private shortcutSO: SceneObject
  private shortcutItem: FlexItem
  private shortcutLabel: Text
  private wantVisible = false
  private initialized = false
  private _onShortcut = new Event<void>()

  get onShortcut(): PublicApi<void> { return this._onShortcut.publicApi() }
  public get isShown(): boolean { return this.wantVisible }
  public get currentTitle(): string { return this.wantVisible && this.title ? this.title.text : "" }
  public get currentText(): string { return this.wantVisible && this.body ? this.body.text + (this.count.text ? " " + this.count.text : "") : "" }
  public get shortcutText(): string { return this.shortcutSO && this.shortcutSO.enabled ? this.shortcutLabel.text : "" }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("InfoPanel")
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
    flex.rowGap = 0.3
    flex.paddingLeft = 1
    flex.paddingRight = 1
    flex.paddingTop = 0.8
    flex.paddingBottom = 0.8
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const w = this.cardWidthCm - 2
    const title = this.addText(content, "InfoTitle", "Title", w, 2.1, new vec4(1, 0.9, 0.5, 1), HorizontalAlignment.Left)
    const body = this.addText(content, "InfoBody", "Body", w, 8, new vec4(1, 1, 1, 1), HorizontalAlignment.Left)
    body.text.verticalAlignment = VerticalAlignment.Top
    const count = this.addText(content, "InfoCount", "Count", w, 0.01, new vec4(1, 0.9, 0.5, 1), HorizontalAlignment.Center)
    this.title = title.text
    this.body = body.text
    this.count = count.text
    this.bodyItem = body.item
    this.countItem = count.item

    // one shortcut button ("Rehearse" / "Stretch")
    this.shortcutSO = global.scene.createSceneObject("InfoShortcutButton")
    this.shortcutSO.setParent(content)
    this.shortcutSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const bw = 11
    const bh = 3.2
    const btn = this.shortcutSO.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"})
    btn.size = new vec3(bw, bh, 1)
    btn.onTriggerUp.add(() => this._onShortcut.invoke())
    const lso = global.scene.createSceneObject("Label")
    lso.setParent(this.shortcutSO)
    lso.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const lt = lso.createComponent("Component.Text") as Text
    lt.font = FONT_JA
    lt.depthTest = true
    applyTextRole(lt, "Body", VIEW_DISTANCE_CM)
    lt.textFill.color = new vec4(1, 0.95, 0.62, 1)
    lt.horizontalAlignment = HorizontalAlignment.Center
    lt.verticalAlignment = VerticalAlignment.Center
    lt.horizontalOverflow = HorizontalOverflow.Shrink
    lt.layoutRect = Rect.create(-(bw - 1) / 2, (bw - 1) / 2, -bh / 2, bh / 2)
    this.shortcutLabel = lt
    this.shortcutItem = this.shortcutSO.createComponent(FlexItem.getTypeName()) as FlexItem
    this.shortcutItem.overrideWidth = bw
    this.shortcutItem.overrideHeight = bh
    flex.addItems([title.item, body.item, count.item, this.shortcutItem])

    let pending = 2
    const done = () => {
      if (--pending > 0) return
      this.initialized = true
      this.panel.enabled = this.wantVisible
    }
    plate.onInitialized.add(done)
    btn.onInitialized.add(done)
  }

  /** Text card: a title, a few lines, and an optional shortcut button. */
  public showLines(title: string, lines: string[], shortcut: string = ""): void {
    this.title.text = title
    this.body.text = lines.join("\n")
    // long lines (e.g. a looked-up summary) wrap: about 34 characters per row at this card width
    const perRow = Math.max(10, Math.round((this.cardWidthCm - 2) * 1.4))
    let rows = 0
    for (const l of lines) rows += Math.max(1, Math.ceil(l.length / perRow))
    this.body.horizontalOverflow = HorizontalOverflow.Wrap
    this.body.verticalOverflow = VerticalOverflow.Shrink
    this.setHeights(Math.max(1, rows) * 1.55, 0)
    this.count.text = ""
    this.setShortcut(shortcut)
    this.setVisible(true)
  }

  /** Timer card: the label and a big countdown. */
  public showCountdown(label: string, seconds: number, shortcut: string = ""): void {
    this.title.text = label
    this.body.text = ""
    const s = Math.max(0, Math.ceil(seconds))
    this.count.text = Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60)
    this.setHeights(0.01, 5.2)
    this.setShortcut(shortcut)
    this.setVisible(true)
  }

  public hide(): void {
    this.setVisible(false)
  }

  private setShortcut(label: string): void {
    this.shortcutLabel.text = label
    this.shortcutSO.enabled = label.length > 0
    this.shortcutItem.overrideHeight = label.length > 0 ? 3.2 : 0.01
  }

  private setHeights(bodyH: number, countH: number): void {
    const w = this.cardWidthCm - 2
    this.bodyItem.overrideHeight = bodyH
    this.body.layoutRect = Rect.create(-w / 2, w / 2, -bodyH / 2, bodyH / 2)
    this.countItem.overrideHeight = Math.max(0.01, countH)
    this.count.layoutRect = Rect.create(-w / 2, w / 2, -countH / 2, countH / 2)
  }

  private setVisible(on: boolean): void {
    this.wantVisible = on
    if (this.initialized) this.panel.enabled = on
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
