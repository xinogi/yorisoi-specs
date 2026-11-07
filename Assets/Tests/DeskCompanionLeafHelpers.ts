/**
 * DeskCompanionLeafHelpers — shared helpers for the Desk Companion LEAF scenarios (test code only).
 *
 * - Finds the lens components the scenarios read (controller, voice, bubble, page, actions, book).
 * - waitUntil(): frame-polling wait with a timeout.
 * - CheckList: collects named checks, prints PASS/FAIL lines, and fails the scenario at the end
 *   with every failed check listed (so one run reports all sub-results).
 * - LeafHead: turns the preview camera with LEAF's own head controller (Leaf.lspkg/IKSolver/
 *   HeadController — the same physics the IK interactor uses to aim the head), or snaps it.
 *
 * Never changes the lens's behavior; the only runtime writes are the camera pose / its
 * DeviceTracking enable flag (restored afterwards) and tunables a scenario restores itself.
 */
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {UpdateDispatcher} from "Leaf.lspkg/Utils/common/UpdateDispatcher"
import {HeadController} from "Leaf.lspkg/IKSolver/HeadController"
import {PoseTransform} from "Leaf.lspkg/IKSolver/PoseTransform"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {DeskCompanionController} from "../Scripts/DeskCompanionController"
import {DeskCompanionVoice} from "../Scripts/DeskCompanionVoice"
import {DeskCompanionSpeechBubbleUI} from "../Scripts/DeskCompanionSpeechBubbleUI"
import {DeskCompanionForeignPageUI} from "../Scripts/DeskCompanionForeignPageUI"
import {DeskCompanionActionsUI} from "../Scripts/DeskCompanionActionsUI"
import {DeskCompanionBook} from "../Scripts/DeskCompanionBook"
import {DeskCompanionAnimator} from "../Scripts/DeskCompanionAnimator"

export const TAG = "[DC-LEAF]"

export function log(msg: string): void {
  print(TAG + " " + msg)
}

export function f1(n: number): string {
  return n.toFixed(1)
}

function requireObject(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`SceneObject "${name}" not found`)
  return so
}

function requireComponent<T>(objectName: string, typeName: any): T {
  const c = requireObject(objectName).getComponent(typeName as any) as unknown as T
  if (!c) throw new Error(`Component ${typeName} not found on "${objectName}"`)
  return c
}

/** All lens components the scenarios read. Object names verified in the scene (Room/...). */
export class Lens {
  readonly companion = requireObject("Companion")
  readonly controller = requireComponent<DeskCompanionController>("Companion", DeskCompanionController.getTypeName())
  readonly animator = requireComponent<DeskCompanionAnimator>("Companion", DeskCompanionAnimator.getTypeName())
  readonly voice = requireComponent<DeskCompanionVoice>("VoiceSource", DeskCompanionVoice.getTypeName())
  readonly bubble = requireComponent<DeskCompanionSpeechBubbleUI>("SpeechBubble", DeskCompanionSpeechBubbleUI.getTypeName())
  readonly page = requireComponent<DeskCompanionForeignPageUI>("ForeignPage", DeskCompanionForeignPageUI.getTypeName())
  readonly actions = requireComponent<DeskCompanionActionsUI>("ActionsPanel", DeskCompanionActionsUI.getTypeName())
  readonly book = requireComponent<DeskCompanionBook>("Book", DeskCompanionBook.getTypeName())

  /** Her root (feet) world position. */
  herPos(): vec3 {
    return this.companion.getTransform().getWorldPosition()
  }

  /** One-line state summary for logs. */
  summary(): string {
    const c = this.controller
    return `state=${c.state} dist=${f1(c.distanceToUserCm)}cm angle=${f1(c.angleOffCenterDeg)}deg inView=${c.isInView} wholeBody=${c.isWholeBodyInView} recentering=${c.isRecentering} line=${this.voice.lastLineId || "-"} bubble=${this.bubble.isShown}`
  }
}

/** Wait until `cond` is true (polled every frame). Resolves true, or false on timeout. */
export async function waitUntil(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = getTime() + timeoutMs / 1000
  while (getTime() < deadline) {
    if (cond()) return true
    await nextFrame()
  }
  return cond()
}

/** Waits for the lens's OnStart to have placed her (controller ready). */
export async function waitForLensReady(lens: Lens, timeoutMs: number = 5000): Promise<boolean> {
  return waitUntil(() => lens.controller.distanceToUserCm > 50, timeoutMs)
}

/** Collects named checks; `finish()` throws listing every failure. */
export class CheckList {
  private failures: string[] = []
  private count = 0

  constructor(private readonly scenario: string) {}

  check(name: string, ok: boolean, detail: string): boolean {
    this.count++
    log(`${this.scenario} ${ok ? "PASS" : "FAIL"} ${name} :: ${detail}`)
    if (!ok) this.failures.push(`${name} (${detail})`)
    return ok
  }

  finish(): void {
    log(`${this.scenario} SUMMARY ${this.count - this.failures.length}/${this.count} checks passed`)
    if (this.failures.length > 0) {
      throw new Error(`${this.failures.length} check(s) failed: ` + this.failures.join(" | "))
    }
  }
}

/** Angle (deg) of a world point from the camera's view axis, split into horizontal / vertical. */
export function viewAngles(camT: Transform, worldPoint: vec3): {h: number; v: number; behind: boolean} {
  const d = camT.getWorldRotation().invert().multiplyVec3(worldPoint.sub(camT.getWorldPosition()))
  return {
    h: (Math.atan2(d.x, -d.z) * 180) / Math.PI,
    v: (Math.atan2(d.y, -d.z) * 180) / Math.PI,
    behind: d.z >= 0
  }
}

/** Specs display half-angles used by the brief (37° tall x 32° wide). */
export const FOV_HALF_H = 16
export const FOV_HALF_V = 18.5

export type TurnMode = "leafHead" | "snap"

/**
 * Turns the preview camera ("the user's head").
 * - "leafHead": LEAF's HeadController (IK head physics, max ~170°/s) drives the camera pose every
 *   frame via LEAF's UpdateDispatcher, exactly like LEAF's IK interactor aims the head.
 * - "snap": sets the camera rotation instantly (strictest case for the lazy follow).
 * While active, the camera's DeviceTracking can be disabled so the preview's simulated device pose
 * does not overwrite the test pose; `restore()` puts rotation and DeviceTracking back.
 */
export class LeafHead {
  private readonly camT: Transform
  private readonly startRot: quat
  private readonly tracking: DeviceTracking | null
  private readonly trackingWasEnabled: boolean
  private readonly head = new HeadController()
  private readonly pose: PoseTransform
  private unsub: (() => void) | null = null

  constructor(private readonly mode: TurnMode, disableDeviceTracking: boolean) {
    const camComp = WorldCameraFinderProvider.getInstance().getComponent()
    this.camT = camComp.getTransform()
    this.startRot = this.camT.getWorldRotation()
    this.tracking = camComp.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    this.trackingWasEnabled = this.tracking ? this.tracking.enabled : false
    if (this.tracking && disableDeviceTracking) this.tracking.enabled = false
    this.pose = new PoseTransform(this.camT)
    if (mode === "leafHead") {
      this.unsub = UpdateDispatcher.getInstance().onUpdate.add(() => {
        const dt = getDeltaTime()
        if (!(dt > 0)) return
        const p = this.head.update(dt, this.pose.toPose())
        if (p !== undefined) this.pose.apply(p)
      })
    }
  }

  get cameraTransform(): Transform {
    return this.camT
  }

  /** World direction for a yaw (deg, + = left, 0 = world -Z) and pitch (deg, + = up). */
  static direction(yawDeg: number, pitchDeg: number): vec3 {
    const y = (yawDeg * Math.PI) / 180
    const p = (pitchDeg * Math.PI) / 180
    return new vec3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p))
  }

  /** Current camera forward (world). */
  forward(): vec3 {
    return this.camT.getWorldRotation().multiplyVec3(vec3.back())
  }

  /** Signed yaw (deg, + = left) of the current camera forward. */
  yawDeg(): number {
    const f = this.forward()
    return (Math.atan2(-f.x, -f.z) * 180) / Math.PI
  }

  pitchDeg(): number {
    const f = this.forward()
    return (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI
  }

  /**
   * Turn the head to (yaw, pitch) and wait until it is aimed there (within 1°).
   * Returns the time (s) the turn took.
   */
  async turnTo(yawDeg: number, pitchDeg: number, timeoutMs: number = 5000): Promise<number> {
    const t0 = getTime()
    const dir = LeafHead.direction(yawDeg, pitchDeg)
    if (this.mode === "snap") {
      const rot = quat
        .angleAxis((yawDeg * Math.PI) / 180, vec3.up())
        .multiply(quat.angleAxis((pitchDeg * Math.PI) / 180, vec3.right()))
      this.camT.setWorldRotation(rot)
    } else {
      this.head.setTarget(this.camT.getWorldPosition().add(dir.uniformScale(300)))
    }
    await waitUntil(() => {
      const c = this.forward().dot(dir)
      return c >= Math.cos((1 * Math.PI) / 180)
    }, timeoutMs)
    return getTime() - t0
  }

  restore(): void {
    if (this.unsub) {
      this.unsub()
      this.unsub = null
    }
    this.camT.setWorldRotation(this.startRot)
    if (this.tracking) this.tracking.enabled = this.trackingWasEnabled
  }
}
