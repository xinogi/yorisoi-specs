/**
 * DeskCompanionLeafInteractor — LEAF interactor for the Desk Companion scenarios (test code only).
 *
 * tap(name): SIK hover -> pinch -> release on the interactable named `name` (UIKit buttons are
 *   SIK Interactables on the SceneObject of the same name: CallButton, Word_<id>, DanceButton...).
 * grabMoveTo(name, dest): pinch-grab an InteractableManipulation object (the Book), carry it to a
 *   world point at a hand-like speed, hold briefly, then release. Uses DIRECT targeting (the hand
 *   holds the object) so SIK's far-field depth "stretch" does not apply — with LEAF's simulated
 *   controller (maxRaycastDistance 0) an indirect grab would yank the object to the ray origin.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {nextFrame, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {log, f1} from "./DeskCompanionLeafHelpers"

export class DeskCompanionLeafInteractor extends DefaultLeafInteractor {
  constructor() {
    super("DeskCompanionLeafInteractor")
  }

  find(name: string): Interactable {
    const it = findInteractableByName(name, undefined, true)
    if (!it) throw new Error(`Interactable "${name}" not found or not enabled`)
    return it
  }

  /** Pinch (hover -> select -> release) the interactable on SceneObject `name`. */
  async tap(name: string): Promise<void> {
    const it = this.find(name)
    log(`tap ${name}`)
    await withTimeout(this.trigger(it), 5000, `tap "${name}" did not complete in 5 s`)
  }

  /**
   * Grab the interactable `name`, carry it so `moved` (its SceneObject by default) reaches `dest`,
   * hold `holdMs`, then release. Returns where the object was when released.
   */
  async grabMoveTo(name: string, dest: vec3, speedCmPerSec: number, holdMs: number = 300, timeoutMs: number = 8000): Promise<{reached: boolean; releasedAt: vec3}> {
    const target = this.find(name)
    const moved = target.getSceneObject().getTransform()
    const previousMode = this.targetingMode
    this.targetingMode = TargetingMode.Direct
    let reached = false
    let releasedAt = moved.getWorldPosition()
    try {
      await this.enterHover(target)
      await nextFrame()
      await nextFrame()
      this.startSelecting()
      await nextFrame()
      await nextFrame()

      // the grab point (endPoint) keeps a fixed offset to the object; steer the grab point
      const offset = moved.getWorldPosition().sub(this.endPoint)
      const goal = dest.sub(offset)
      log(`grab ${name} at ${vecStr(moved.getWorldPosition())} -> carry to ${vecStr(dest)}`)
      const deadline = getTime() + timeoutMs / 1000
      while (getTime() < deadline) {
        const rem = goal.sub(this.endPoint)
        const dist = rem.length
        if (dist < 0.05) break
        const dt = Math.min(Math.max(getDeltaTime(), 1 / 120), 1 / 15)
        const step = rem.uniformScale(Math.min(1, (speedCmPerSec * dt) / dist))
        this.startPoint = this.startPoint.add(step)
        this.endPoint = this.endPoint.add(step)
        this.overrideDragVector = step
        await nextFrame()
      }
      this.overrideDragVector = vec3.zero()
      // let SIK's manipulation filter catch up with the hand
      await waitFrames(() => moved.getWorldPosition().distance(dest) < 1.5, 1500)
      await sleep(holdMs)
      reached = moved.getWorldPosition().distance(dest) < 3
    } finally {
      releasedAt = moved.getWorldPosition()
      log(`release ${name} at ${vecStr(releasedAt)} (reached=${reached})`)
      this.stopSelecting()
      await nextFrame()
      await nextFrame()
      this.overrideDragVector = undefined
      this.resetStartEndPoint()
      try {
        await withTimeout(this.exitHover(), 2000, "hover exit timeout")
      } catch (e) {
        log(`note: ${e}`)
      }
      this.targetingMode = previousMode
    }
    return {reached, releasedAt}
  }
}

async function waitFrames(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = getTime() + timeoutMs / 1000
  while (getTime() < deadline) {
    if (cond()) return true
    await nextFrame()
  }
  return cond()
}

export function vecStr(v: vec3): string {
  return `(${f1(v.x)}, ${f1(v.y)}, ${f1(v.z)})`
}
