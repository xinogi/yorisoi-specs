/**
 * DeskCompanionCallButtonUI — the big "Call" button lying on the front-right of the desk
 * ("I spoke to her" stand-in; on real glasses voice would do the same job).
 *
 * Owns: a UIKit round Button (yellow, waving-hand icon) on a small BackPlate with a bilingual label.
 * The Button lives on a SceneObject named "CallButton" so LEAF can find its interactable.
 * Public API: onCall (Event<void>).
 * Must not: talk to the companion directly (DeskCompanionMain subscribes to onCall).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Subheadline" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Subheadline: {size: 41, weight: 700}, Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
const ICON_WAVE = requireAsset("../Icons/waving_hand.png") as Texture

/** Viewing distance from the eyes to the button on the desk (cm). */
const VIEW_DISTANCE_CM = 80

@component
export class DeskCompanionCallButtonUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionCallButtonUI – big Call button on the desk</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(4, 14, 0.5))
  @hint("Button diameter (cm) — brief: about 8 cm, big and easy to press")
  buttonDiameterCm: number = 8

  @input
  @widget(new SliderWidget(1.5, 6, 0.1))
  @hint("Icon size on the button (cm)")
  iconSizeCm: number = 3.6

  @input
  @hint("Label under the button")
  labelText: string = "Call"

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Label color (keep light)")
  labelColor: vec4
  @ui.group_end

  private _onCall = new Event<void>()

  /** Fires when the Call button is pinched. */
  get onCall(): PublicApi<void> {
    return this._onCall.publicApi()
  }

  onAwake(): void {
    const panel = global.scene.createSceneObject("CallPanel")
    panel.setParent(this.getSceneObject())
    panel.createComponent("Component.Canvas")
    const plate = panel.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    const w = this.buttonDiameterCm + 4
    flex.width = w
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.rowGap = 0.6
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.0
    flex.paddingLeft = 1.0
    flex.paddingRight = 1.0
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // The button (sole child of its SceneObject's face -> ElementContent icon is safe here)
    const btnSO = global.scene.createSceneObject("CallButton")
    btnSO.setParent(content)
    btnSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    btn.size = new vec3(this.buttonDiameterCm, this.buttonDiameterCm, 1.2)
    const ec = btnSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = ICON_WAVE
    ec.leadingIconSize = this.iconSizeCm
    btn.onTriggerUp.add(() => this._onCall.invoke())
    const btnItem = btnSO.createComponent(FlexItem.getTypeName()) as FlexItem
    btnItem.overrideWidth = this.buttonDiameterCm
    btnItem.overrideHeight = this.buttonDiameterCm

    // Label
    const labelSO = global.scene.createSceneObject("CallLabel")
    labelSO.setParent(content)
    labelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const t = labelSO.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = this.labelText
    t.depthTest = true
    applyTextRole(t, "Subheadline", VIEW_DISTANCE_CM)
    t.textFill.color = this.labelColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    const lw = w - 2
    t.layoutRect = Rect.create(-lw / 2, lw / 2, -1.1, 1.1)
    const labelItem = labelSO.createComponent(FlexItem.getTypeName()) as FlexItem
    labelItem.overrideWidth = lw
    labelItem.overrideHeight = 2.2
    labelItem.alignSelf = FlexAlignSelf.Stretch

    flex.addItems([btnItem, labelItem])
  }
}
