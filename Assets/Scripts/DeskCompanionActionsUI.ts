/**
 * DeskCompanionActionsUI — the small "Dance / Pose" panel that appears near her after she has
 * come over, and hides when she walks away.
 *
 * Owns: a UIKit BackPlate with two UIKit Buttons on SceneObjects named "DanceButton" and
 * "PoseButton" (LEAF-findable), and the show/hide animation. A passive view.
 * Public API: onDance, onPose (Event<void>), show(), hide(), isShown.
 * Placement/facing is done by DeskCompanionBillboard on the same SceneObject.
 * Must not: decide whether she can dance (the controller does).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"

const FONT_SIZE_SCALE = 0.95
type TextRole = "Button" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Button: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}
const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
const ICON_DANCE = requireAsset("../Icons/music_note.png") as Texture
const ICON_POSE = requireAsset("../Icons/photo_camera.png") as Texture
const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

/** The panel floats about 1 m from the user. */
const VIEW_DISTANCE_CM = 100
const BUTTON_LABEL_Z = 0.08

@component
export class DeskCompanionActionsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionActionsUI – Dance / Pose buttons near her</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(5, 14, 0.5))
  @hint("Width of each button (cm)")
  buttonWidthCm: number = 7.5

  @input
  @widget(new SliderWidget(3, 8, 0.5))
  @hint("Height of each button (cm)")
  buttonHeightCm: number = 4.5

  @input
  @hint("Dance button label")
  danceLabel: string = "ダンス Dance"

  @input
  @hint("Pose button label")
  poseLabel: string = "ポーズ Pose"
  @ui.group_end

  private panel: SceneObject
  private wantVisible = false
  private pendingInits = 3
  private initialized = false
  private cancel: CancelFunction | null = null
  private _onDance = new Event<void>()
  private _onPose = new Event<void>()

  get onDance(): PublicApi<void> { return this._onDance.publicApi() }
  get onPose(): PublicApi<void> { return this._onPose.publicApi() }
  public get isShown(): boolean { return this.wantVisible }

  onAwake(): void {
    this.panel = global.scene.createSceneObject("ActionsButtons")
    this.panel.setParent(this.getSceneObject())
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = -1
    flex.height = -1
    flex.direction = FlexDirection.Row
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.columnGap = 0.8
    flex.paddingTop = 0.8
    flex.paddingBottom = 0.8
    flex.paddingLeft = 0.8
    flex.paddingRight = 0.8
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const dance = this.addButton(content, "DanceButton", this.danceLabel, ICON_DANCE, () => this._onDance.invoke())
    const pose = this.addButton(content, "PoseButton", this.poseLabel, ICON_POSE, () => this._onPose.invoke())
    flex.addItems([dance.item, pose.item])

    const done = () => {
      this.pendingInits--
      if (this.pendingInits > 0) return
      this.initialized = true
      if (this.wantVisible) this.pop(true)
      else this.panel.enabled = false // start hidden — at the tail of init
    }
    plate.onInitialized.add(done)
    dance.button.onInitialized.add(done)
    pose.button.onInitialized.add(done)
  }

  public show(): void {
    this.wantVisible = true
    if (this.initialized) this.pop(true)
  }

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
          const s = 0.7 + 0.3 * t
          tr.setLocalScale(new vec3(s, s, s))
        }
      })
    } else {
      if (!this.panel.enabled) return
      this.cancel = animate({
        duration: 0.2,
        easing: "ease-in-out-quad",
        update: (t: number) => {
          const s = 1 - 0.3 * t
          tr.setLocalScale(new vec3(s, s, s))
        },
        ended: () => {
          if (!this.wantVisible) this.panel.enabled = false
          tr.setLocalScale(vec3.one())
        }
      })
    }
  }

  private addButton(parent: SceneObject, name: string, label: string, icon: Texture, onTap: () => void): {button: Button; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Rectangle", style: "PrimaryNeutral"})
    btn.size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    btn.onTriggerUp.add(onTap)

    // Face: icon above, label below, laid out by a FlexLayout column on the button
    const face = global.scene.createSceneObject("Face")
    face.setParent(so)
    face.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const f = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
    f.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    f.width = this.buttonWidthCm
    f.height = this.buttonHeightCm
    f.direction = FlexDirection.Column
    f.justifyContent = FlexJustify.Center
    f.alignItems = FlexAlign.Center
    f.rowGap = 0.25

    const iconSO = global.scene.createSceneObject("Icon")
    iconSO.setParent(face)
    const img = iconSO.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = icon
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    const iconSize = Math.min(2.0, this.buttonHeightCm * 0.42)
    iconSO.getTransform().setLocalScale(new vec3(iconSize, iconSize, 1))
    const iconItem = iconSO.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.overrideWidth = iconSize
    iconItem.overrideHeight = iconSize

    const labelSO = global.scene.createSceneObject("Label")
    labelSO.setParent(face)
    const t = labelSO.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = label
    t.depthTest = true
    applyTextRole(t, "Caption", VIEW_DISTANCE_CM)
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const lw = this.buttonWidthCm - 0.5
    t.layoutRect = Rect.create(-lw / 2, lw / 2, -0.8, 0.8)
    const labelItem = labelSO.createComponent(FlexItem.getTypeName()) as FlexItem
    labelItem.overrideWidth = lw
    labelItem.overrideHeight = 1.6
    f.addItems([iconItem, labelItem])

    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return {button: btn, item}
  }
}
