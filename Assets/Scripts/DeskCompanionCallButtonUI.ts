/**
 * DeskCompanionCallButtonUI — the big "Call" button lying on the front-right of the desk
 * ("I spoke to her" stand-in; on real glasses voice would do the same job).
 *
 * Owns: a UIKit round Button (yellow, waving-hand icon) on a small BackPlate with a label, a
 * "Chat: Off / Chat: On" toggle under it (she only talks on her own when Chat is on), and her
 * voice volume: a UIKit Slider "Voice" (0-100 %) with a Mute / Unmute button beside it.
 * Under that, "Yori: Visible / Yori: Voice only" (hide her body, keep everything else).
 * SceneObjects "CallButton", "ChatButton", "VoiceSlider", "MuteButton", "AvatarButton" (LEAF).
 * Public API: onCall, onChatToggle, onMuteToggle, onAvatarToggle (Event<void>),
 *   onVoiceVolume (Event<number>, 0-1), setChatState(on), setVoiceState(volume01, muted),
 *   setAvatarState(visible).
 * Must not: talk to the companion directly (DeskCompanionMain subscribes to onCall).
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
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

  @input
  @hint("Chat toggle label when chat is off")
  chatOffLabel: string = "Chat: Off"

  @input
  @hint("Chat toggle label when chat is on")
  chatOnLabel: string = "Chat: On"
  @ui.group_end

  private _onCall = new Event<void>()
  private _onChatToggle = new Event<void>()
  private _onMuteToggle = new Event<void>()
  private _onAvatarToggle = new Event<void>()
  private avatarText: Text | null = null

  /** Fires when the "Yori: Visible / Voice only" toggle is pinched. */
  get onAvatarToggle(): PublicApi<void> {
    return this._onAvatarToggle.publicApi()
  }

  /** Show whether her body is visible or voice only. */
  setAvatarState(visible: boolean): void {
    if (this.avatarText) this.avatarText.text = visible ? "Yori: Visible" : "Yori: Voice only"
  }
  private _onVoiceVolume = new Event<number>()
  private _onMusicVolume = new Event<number>()
  private musicText: Text | null = null

  /** Fires with the new music volume (0-1) while the Music slider moves. */
  get onMusicVolume(): PublicApi<number> {
    return this._onMusicVolume.publicApi()
  }

  /** Show the music volume. */
  setMusicState(volume01: number): void {
    if (this.musicText) this.musicText.text = "Music " + Math.round(volume01 * 100) + "%"
  }
  private chatText: Text | null = null
  private voiceText: Text | null = null
  private muteText: Text | null = null
  private voiceSlider: Slider | null = null

  /** Fires when the Mute / Unmute button is pinched. */
  get onMuteToggle(): PublicApi<void> {
    return this._onMuteToggle.publicApi()
  }

  /** Fires with the new voice volume (0-1) while the Voice slider moves. */
  get onVoiceVolume(): PublicApi<number> {
    return this._onVoiceVolume.publicApi()
  }

  /** Show the current voice volume / mute state. */
  setVoiceState(volume01: number, muted: boolean): void {
    if (this.voiceText) this.voiceText.text = muted ? "Voice: muted" : "Voice " + Math.round(volume01 * 100) + "%"
    if (this.muteText) this.muteText.text = muted ? "Unmute" : "Mute"
    if (this.voiceSlider && Math.abs(this.voiceSlider.currentValue - volume01) > 0.005) this.voiceSlider.currentValue = volume01
  }

  /** Fires when the Chat toggle is pinched (DeskCompanionMain flips the companion's chat setting). */
  get onChatToggle(): PublicApi<void> {
    return this._onChatToggle.publicApi()
  }

  /** Show the current chat setting on the toggle. */
  setChatState(on: boolean): void {
    if (this.chatText) this.chatText.text = on ? this.chatOnLabel : this.chatOffLabel
  }

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
    const w = Math.max(this.buttonDiameterCm + 4, 14)
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

    // Chat toggle (capsule) — off by default: she stays quiet unless you act
    const chatW = w - 2
    const chatH = 2.8
    const chatSO = global.scene.createSceneObject("ChatButton")
    chatSO.setParent(content)
    chatSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const cb = chatSO.createComponent(Button.getTypeName()) as Button
    cb.setVariant({theme: "SnapOS2", shape: "Capsule", style: "PrimaryNeutral"})
    cb.size = new vec3(chatW, chatH, 1)
    cb.onTriggerUp.add(() => this._onChatToggle.invoke())
    const chatLabelSO = global.scene.createSceneObject("ChatLabel")
    chatLabelSO.setParent(chatSO)
    chatLabelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const ct = chatLabelSO.createComponent("Component.Text") as Text
    ct.font = FONT_JA
    ct.text = this.chatOffLabel
    ct.depthTest = true
    applyTextRole(ct, "Caption", VIEW_DISTANCE_CM)
    ct.textFill.color = new vec4(1, 1, 1, 1)
    ct.horizontalAlignment = HorizontalAlignment.Center
    ct.verticalAlignment = VerticalAlignment.Center
    ct.horizontalOverflow = HorizontalOverflow.Shrink
    ct.verticalOverflow = VerticalOverflow.Overflow
    ct.layoutRect = Rect.create(-(chatW - 0.8) / 2, (chatW - 0.8) / 2, -chatH / 2, chatH / 2)
    this.chatText = ct
    const chatItem = chatSO.createComponent(FlexItem.getTypeName()) as FlexItem
    chatItem.overrideWidth = chatW
    chatItem.overrideHeight = chatH

    // Voice volume: label, then slider + Mute button in a row
    const voiceLabelSO = global.scene.createSceneObject("VoiceLabel")
    voiceLabelSO.setParent(content)
    voiceLabelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const vt = voiceLabelSO.createComponent("Component.Text") as Text
    vt.font = FONT_JA
    vt.text = "Voice 70%"
    vt.depthTest = true
    applyTextRole(vt, "Caption", VIEW_DISTANCE_CM)
    vt.textFill.color = this.labelColor
    vt.horizontalAlignment = HorizontalAlignment.Left
    vt.verticalAlignment = VerticalAlignment.Center
    vt.horizontalOverflow = HorizontalOverflow.Overflow
    vt.verticalOverflow = VerticalOverflow.Overflow
    vt.layoutRect = Rect.create(-lw / 2, lw / 2, -0.9, 0.9)
    this.voiceText = vt
    const voiceLabelItem = voiceLabelSO.createComponent(FlexItem.getTypeName()) as FlexItem
    voiceLabelItem.overrideWidth = lw
    voiceLabelItem.overrideHeight = 1.8
    voiceLabelItem.alignSelf = FlexAlignSelf.Stretch

    const muteW = 4.2
    const rowH = 2.6
    const sliderW = lw - muteW - 0.6
    const vrow = global.scene.createSceneObject("VoiceRow")
    vrow.setParent(content)
    vrow.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const vf = vrow.createComponent(FlexLayout.getTypeName()) as FlexLayout
    vf.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    vf.direction = FlexDirection.Row
    vf.justifyContent = FlexJustify.SpaceBetween
    vf.alignItems = FlexAlign.Center
    vf.width = lw
    vf.height = rowH
    const vrowItem = vrow.createComponent(FlexItem.getTypeName()) as FlexItem
    vrowItem.overrideWidth = lw
    vrowItem.overrideHeight = rowH

    const sliderSO = global.scene.createSceneObject("VoiceSlider")
    sliderSO.setParent(vrow)
    sliderSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const slider = sliderSO.createComponent(Slider.getTypeName()) as Slider
    slider.size = new vec3(sliderW, 1.6, 1) // size before the slider initializes (UIKit gotcha)
    slider.currentValue = 0.7
    slider.onValueChange.add((v: number) => this._onVoiceVolume.invoke(v))
    this.voiceSlider = slider
    const sliderItem = sliderSO.createComponent(FlexItem.getTypeName()) as FlexItem
    sliderItem.overrideWidth = sliderW
    sliderItem.overrideHeight = 1.6

    const muteSO = global.scene.createSceneObject("MuteButton")
    muteSO.setParent(vrow)
    muteSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const mb = muteSO.createComponent(Button.getTypeName()) as Button
    mb.setVariant({theme: "SnapOS2", shape: "Capsule", style: "PrimaryNeutral"})
    mb.size = new vec3(muteW, rowH, 1)
    mb.onTriggerUp.add(() => this._onMuteToggle.invoke())
    const muteLabelSO = global.scene.createSceneObject("MuteLabel")
    muteLabelSO.setParent(muteSO)
    muteLabelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const mt = muteLabelSO.createComponent("Component.Text") as Text
    mt.font = FONT_JA
    mt.text = "Mute"
    mt.depthTest = true
    applyTextRole(mt, "Caption", VIEW_DISTANCE_CM)
    mt.textFill.color = new vec4(1, 1, 1, 1)
    mt.horizontalAlignment = HorizontalAlignment.Center
    mt.verticalAlignment = VerticalAlignment.Center
    mt.horizontalOverflow = HorizontalOverflow.Shrink
    mt.verticalOverflow = VerticalOverflow.Overflow
    mt.layoutRect = Rect.create(-(muteW - 0.6) / 2, (muteW - 0.6) / 2, -rowH / 2, rowH / 2)
    this.muteText = mt
    const muteItem = muteSO.createComponent(FlexItem.getTypeName()) as FlexItem
    muteItem.overrideWidth = muteW
    muteItem.overrideHeight = rowH
    vf.addItems([sliderItem, muteItem])

    // Yori: Visible / Voice only (capsule, like Chat)
    const avSO = global.scene.createSceneObject("AvatarButton")
    avSO.setParent(content)
    avSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const ab = avSO.createComponent(Button.getTypeName()) as Button
    ab.setVariant({theme: "SnapOS2", shape: "Capsule", style: "PrimaryNeutral"})
    ab.size = new vec3(chatW, chatH, 1)
    ab.onTriggerUp.add(() => this._onAvatarToggle.invoke())
    const avLabelSO = global.scene.createSceneObject("AvatarLabel")
    avLabelSO.setParent(avSO)
    avLabelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const at = avLabelSO.createComponent("Component.Text") as Text
    at.font = FONT_JA
    at.text = "Yori: Visible"
    at.depthTest = true
    applyTextRole(at, "Caption", VIEW_DISTANCE_CM)
    at.textFill.color = new vec4(1, 1, 1, 1)
    at.horizontalAlignment = HorizontalAlignment.Center
    at.verticalAlignment = VerticalAlignment.Center
    at.horizontalOverflow = HorizontalOverflow.Shrink
    at.verticalOverflow = VerticalOverflow.Overflow
    at.layoutRect = Rect.create(-(chatW - 0.8) / 2, (chatW - 0.8) / 2, -chatH / 2, chatH / 2)
    this.avatarText = at
    const avItem = avSO.createComponent(FlexItem.getTypeName()) as FlexItem
    avItem.overrideWidth = chatW
    avItem.overrideHeight = chatH

    // Music volume: label + slider (music itself is started with the Music button near her)
    const musicLabelSO = global.scene.createSceneObject("MusicLabel")
    musicLabelSO.setParent(content)
    musicLabelSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const mlt = musicLabelSO.createComponent("Component.Text") as Text
    mlt.font = FONT_JA
    mlt.text = "Music 40%"
    mlt.depthTest = true
    applyTextRole(mlt, "Caption", VIEW_DISTANCE_CM)
    mlt.textFill.color = this.labelColor
    mlt.horizontalAlignment = HorizontalAlignment.Left
    mlt.verticalAlignment = VerticalAlignment.Center
    mlt.horizontalOverflow = HorizontalOverflow.Overflow
    mlt.verticalOverflow = VerticalOverflow.Overflow
    mlt.layoutRect = Rect.create(-lw / 2, lw / 2, -0.9, 0.9)
    this.musicText = mlt
    const musicLabelItem = musicLabelSO.createComponent(FlexItem.getTypeName()) as FlexItem
    musicLabelItem.overrideWidth = lw
    musicLabelItem.overrideHeight = 1.8
    musicLabelItem.alignSelf = FlexAlignSelf.Stretch
    const msSO = global.scene.createSceneObject("MusicSlider")
    msSO.setParent(content)
    msSO.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const ms = msSO.createComponent(Slider.getTypeName()) as Slider
    ms.size = new vec3(lw, 1.6, 1) // size before the slider initializes (UIKit gotcha)
    ms.currentValue = 0.4
    ms.onValueChange.add((v: number) => this._onMusicVolume.invoke(v))
    const msItem = msSO.createComponent(FlexItem.getTypeName()) as FlexItem
    msItem.overrideWidth = lw
    msItem.overrideHeight = 1.8

    flex.addItems([btnItem, labelItem, chatItem, voiceLabelItem, vrowItem, avItem, musicLabelItem, msItem])
  }
}
