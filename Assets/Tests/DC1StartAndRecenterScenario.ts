/**
 * Done criterion 1 — at start she is in front ~2.5 m away, slightly right, idling; whole body in
 * view at the ~14° desk gaze; turning the head far left / right / behind makes her glide back to
 * the front of view within ~2 s.
 *
 * Parameters: turnMode = "leafHead" (LEAF HeadController turns the camera) | "snap" (instant);
 *             disableDeviceTracking = "true" | "false" (keep the preview device pose from
 *             overwriting the test head pose); recenterLimitMs = "2000".
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, f1, Lens, LeafHead, log, TurnMode, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"

const REST_DISTANCE_CM = 250
const WANDER_CM = 30
const REST_OFFSET_DEG = 8

@component
export class DC1StartAndRecenterScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const turnMode = ((config && config.get("turnMode")) || "leafHead") as TurnMode
    const disableTracking = ((config && config.get("disableDeviceTracking")) || "true") === "true"
    const limitMs = (config && config.getNumber("recenterLimitMs")) || 2000
    const checks = new CheckList("DC1")
    const lens = new Lens()
    const c = lens.controller
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    log(`DC1 start (turnMode=${turnMode}, disableDeviceTracking=${disableTracking}) :: ${lens.summary()}`)

    // the preview camera settles a frame or two after the Lens starts, which can trigger one
    // recenter glide right at start; measure the resting spot once that glide has finished
    const settled = await waitUntil(() => !c.isRecentering, 2500)
    log(`DC1 start settled=${settled} :: ${lens.summary()}`)

    // ── 1a. at start: in front, ~2.5 m, slightly right, idling ──
    const d0 = c.distanceToUserCm
    const a0 = c.angleOffCenterDeg
    const s0 = c.state
    checks.check("start distance ~250 cm", Math.abs(d0 - REST_DISTANCE_CM) <= WANDER_CM + 1, `dist=${f1(d0)} (rest 250 ± wander 30)`)
    checks.check("start angle 5..11 deg right", a0 >= 5 && a0 <= 11, `angle=${f1(a0)}`)
    checks.check("start isInView", c.isInView, `isInView=${c.isInView}`)
    checks.check("start state roam_idle|roam_walk", s0 === "roam_idle" || s0 === "roam_walk", `state=${s0}`)
    checks.check("animator strategy video", lens.animator.strategy === "video", `strategy=${lens.animator.strategy} currentAnim=${lens.animator.currentAnim}`)

    const savedTease = c.idleTeaseSeconds
    c.idleTeaseSeconds = 999 // keep the tease from starting during the head turns (restored below)
    const head = new LeafHead(turnMode, disableTracking)
    try {
      // ── 1b. desk gaze: pitched ~14° down -> whole body in view ──
      const tPitch = await head.turnTo(0, -14)
      await sleep(250)
      checks.check(
        "whole body in view at 14 deg down",
        c.isWholeBodyInView,
        `wholeBody=${c.isWholeBodyInView} pitch=${f1(head.pitchDeg())} (turn ${f1(tPitch)} s) dist=${f1(c.distanceToUserCm)} angle=${f1(c.angleOffCenterDeg)} state=${c.state}`
      )
      // looking level: lower legs may leave the narrow view (accepted by the brief) — info only
      await head.turnTo(0, 0)
      await sleep(150)
      log(`DC1 info: looking level wholeBody=${c.isWholeBodyInView} (brief accepts lower legs out of view)`)

      // ── 1c. far turns: left 60°, back, right 60°, back, then a full about-face (180°) ──
      const turns: Array<{label: string; yaw: number}> = [
        {label: "left 60", yaw: 60},
        {label: "back to front from left", yaw: 0},
        {label: "right 60", yaw: -60},
        {label: "back to front from right", yaw: 0},
        {label: "about-face 180", yaw: 180}
      ]
      let recenterEvents = 0
      const onRecenter = () => recenterEvents++
      c.onRecenter.add(onRecenter)
      for (const t of turns) {
        const before = recenterEvents
        const tStart = getTime()
        const turnS = await head.turnTo(t.yaw, 0)
        const tTurned = getTime()
        const ok = await waitUntil(() => c.isInView && Math.abs(c.angleOffCenterDeg - REST_OFFSET_DEG) < 12, limitMs)
        const backMs = (getTime() - tTurned) * 1000
        const fromStartMs = (getTime() - tStart) * 1000
        checks.check(
          `recenter after turn ${t.label}`,
          ok,
          `back in view ${f1(backMs)} ms after the head stopped (${f1(fromStartMs)} ms after the turn began, turn took ${f1(turnS)} s); headYaw=${f1(head.yawDeg())} angle=${f1(c.angleOffCenterDeg)} inView=${c.isInView} recenterEvents=${recenterEvents - before}`
        )
        // let the glide finish, then confirm she stays put in front
        await waitUntil(() => !c.isRecentering, 2500)
        await sleep(400)
        checks.check(
          `stays in front after ${t.label}`,
          c.isInView && Math.abs(c.angleOffCenterDeg - REST_OFFSET_DEG) < 12 && Math.abs(c.distanceToUserCm - REST_DISTANCE_CM) <= WANDER_CM + 5,
          lens.summary()
        )
      }
      c.onRecenter.remove(onRecenter)
    } finally {
      head.restore()
      c.idleTeaseSeconds = savedTease
    }
    checks.finish()
  }
}
