/**
 * DeskCompanionVoiceDot — the small soft light dot that stands in for Yori in "Voice only" mode.
 * Plain helper (not a component): DeskCompanionController creates it under her VoiceSource (her
 * head, where the spatial voice comes from), shows it while her body is hidden, keeps it facing
 * the user, and makes it pulse gently while she speaks.
 * Owns: the dot SceneObjects only. Must not: decide when it is shown (the controller does).
 */
import {yawQuat} from "./DeskCompanionMath"

const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
/** Text size 100 renders "●" about 2.2 cm wide; scale it up to the ~6 cm dot. */
const DOT_SCALE = 2.7

export class DeskCompanionVoiceDot {
  private readonly so: SceneObject
  private readonly glow: SceneObject
  private phase = 0

  constructor(parent: SceneObject) {
    this.so = global.scene.createSceneObject("VoiceDot")
    this.so.setParent(parent)
    this.so.getTransform().setLocalPosition(vec3.zero())
    // soft halo behind the dot, then the dot itself
    this.glow = this.addGlyph("VoiceDotGlow", new vec4(1, 0.92, 0.75, 0.22), 1.9, -0.05)
    this.addGlyph("VoiceDotCore", new vec4(1, 0.96, 0.86, 0.9), 1, 0)
    this.so.enabled = false
  }

  get enabled(): boolean { return this.so.enabled }

  setEnabled(on: boolean): void {
    this.so.enabled = on
  }

  /** Face the user and pulse while she speaks. */
  update(dt: number, speaking: boolean, camPos: vec3): void {
    if (!this.so.enabled) return
    const t = this.so.getTransform()
    const pos = t.getWorldPosition()
    const dir = new vec3(camPos.x - pos.x, 0, camPos.z - pos.z)
    if (dir.length > 0.001) t.setWorldRotation(yawQuat(dir.uniformScale(-1)))
    this.phase += dt * (speaking ? 7 : 1.5)
    const amp = speaking ? 0.22 : 0.04
    const s = DOT_SCALE * (1 + amp * Math.sin(this.phase))
    t.setLocalScale(new vec3(s, s, s))
    const g = 1 + (speaking ? 0.35 : 0.1) * (0.5 + 0.5 * Math.sin(this.phase * 0.5))
    this.glow.getTransform().setLocalScale(new vec3(1.9 * g, 1.9 * g, 1))
  }

  private addGlyph(name: string, color: vec4, scale: number, z: number): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.so)
    so.getTransform().setLocalPosition(new vec3(0, 0, z))
    so.getTransform().setLocalScale(new vec3(scale, scale, 1))
    const t = so.createComponent("Component.Text") as Text
    t.font = FONT_JA
    t.text = "●"
    t.size = 100
    t.depthTest = true
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    return so
  }
}
