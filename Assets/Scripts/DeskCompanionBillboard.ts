/**
 * DeskCompanionBillboard — keeps a floating panel (speech bubble, dance/pose buttons)
 * turned toward the user, optionally following a target with a camera-relative offset
 * and growing with distance so text stays readable from the desk.
 *
 * Owns: this SceneObject's world position / rotation / scale each frame.
 * Inputs: optional followTarget (e.g. the Companion root) + offset; scaling settings.
 * Must not: create UI or hold any experience state.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {yawQuat} from "./DeskCompanionMath"

@component
export class DeskCompanionBillboard extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionBillboard – face the user, follow a target</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Optional object to follow (e.g. Companion root at her feet). Empty = stay where authored.")
  followTarget: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{16, 174, 0}")
  @hint("Offset from the follow target in cm: x = toward the user's right, y = up, z = toward the user")
  offsetCm: vec3

  @input
  @hint("Grow the panel with distance so text stays legible when she is far away")
  scaleWithDistance: boolean = true

  @input
  @widget(new SliderWidget(40, 300, 5))
  @hint("Distance (cm) at which the panel is shown at its authored size")
  referenceDistanceCm: number = 120

  @input
  @widget(new SliderWidget(1, 4, 0.1))
  @hint("Largest scale multiplier when far away")
  maxScale: number = 2.4
  @ui.group_end

  private camTransform: Transform | null = null
  private baseScale: vec3 = vec3.one()

  onAwake(): void {
    this.baseScale = this.getTransform().getLocalScale()
    this.createEvent("OnStartEvent").bind(() => {
      this.camTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
    })
    this.createEvent("LateUpdateEvent").bind(() => this.tick())
  }

  private tick(): void {
    if (!this.camTransform) return
    const t = this.getTransform()
    const camPos = this.camTransform.getWorldPosition()

    if (this.followTarget && !isNull(this.followTarget)) {
      const base = this.followTarget.getTransform().getWorldPosition()
      const toCam = new vec3(camPos.x - base.x, 0, camPos.z - base.z)
      const flatToCam = toCam.length > 0.001 ? toCam.normalize() : new vec3(0, 0, 1)
      // user's right as seen from the user looking at the target: viewDir x up
      const right = new vec3(flatToCam.z, 0, -flatToCam.x)
      const p = base
        .add(right.uniformScale(this.offsetCm.x))
        .add(new vec3(0, this.offsetCm.y, 0))
        .add(flatToCam.uniformScale(this.offsetCm.z))
      t.setWorldPosition(p)
    }

    const pos = t.getWorldPosition()
    const dir = new vec3(camPos.x - pos.x, 0, camPos.z - pos.z)
    if (dir.length > 0.001) {
      // panel front is local +Z: equivalent to a -Z-front model facing away from the user
      t.setWorldRotation(yawQuat(dir.uniformScale(-1)))
    }

    if (this.scaleWithDistance) {
      const d = camPos.distance(pos)
      const k = Math.min(this.maxScale, Math.max(1, d / this.referenceDistanceCm))
      t.setLocalScale(this.baseScale.uniformScale(k))
    }
  }
}
