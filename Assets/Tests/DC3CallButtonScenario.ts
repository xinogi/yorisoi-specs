/**
 * Done criterion 3 — pinching the Call button makes her say the active mode's call line (default
 * Sweetheart: "Hey, what's up?" / どうしたの？ — line id comes from controller.callLineId) and walk up
 * to ~1.2 m in front, face and upper body in view; the Dance/Pose panel appears near her.
 *
 * Parameter: arriveLimitMs = "2500" (how long she may take to arrive after the pinch).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CheckList, f1, FOV_HALF_H, FOV_HALF_V, Lens, log, viewAngles, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor} from "./DeskCompanionLeafInteractor"
import {findLine} from "../Scripts/DeskCompanionContent"

const APPROACH_DISTANCE_CM = 120

@component
export class DC3CallButtonScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const limitMs = (config && config.getNumber("arriveLimitMs")) || 2500
    const checks = new CheckList("DC3")
    const lens = new Lens()
    const c = lens.controller
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    // UIKit buttons finish initializing a few frames after start
    expect(await waitUntil(() => !!findInteractableByName("CallButton", undefined, true), 5000), "CallButton interactable never appeared").toBe(true)
    await sleep(500)
    log(`DC3 before pinch :: ${lens.summary()} actionsShown=${lens.actions.isShown}`)
    checks.check("she starts far (not near)", !c.isNear && c.distanceToUserCm > 200, `state=${c.state} dist=${f1(c.distanceToUserCm)}`)

    const interactor = new DeskCompanionLeafInteractor()
    const tPinch = getTime()
    await interactor.tap("CallButton")
    await sleep(100)

    const id = lens.voice.lastLineId
    const callId = c.callLineId
    const callLine = findLine(callId)
    checks.check(`says the mode's call line (${callId})`, id === callId && !!callLine, `lastLineId=${id} mode=${c.modeId}`)
    checks.check(
      `bubble shows ${callLine ? callLine.ja + " / " + callLine.en : "?"}`,
      lens.bubble.isShown && !!callLine && lens.bubble.currentJa === callLine.ja && lens.bubble.currentEn === callLine.en,
      `isShown=${lens.bubble.isShown} ja="${lens.bubble.currentJa}" en="${lens.bubble.currentEn}"`
    )

    const arrived = await waitUntil(() => c.state === "attend", limitMs)
    const arriveMs = (getTime() - tPinch) * 1000
    checks.check(`arrives (attend) within ${limitMs} ms`, arrived, `state=${c.state} after ${f1(arriveMs)} ms`)
    if (!arrived) await waitUntil(() => c.state === "attend", 6000) // keep measuring the rest
    await sleep(250)

    const d = c.distanceToUserCm
    checks.check("stops ~1.2 m in front", Math.abs(d - APPROACH_DISTANCE_CM) <= 5, `dist=${f1(d)} (expected 120 ± 5) angle=${f1(c.angleOffCenterDeg)}`)

    // face and upper body in view (camera at its default, level pose)
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const p = lens.herPos()
    const headTop = viewAngles(camT, p.add(new vec3(0, 165, 0)))
    const chest = viewAngles(camT, p.add(new vec3(0, 118, 0)))
    const inFov = (a: {h: number; v: number; behind: boolean}) => !a.behind && Math.abs(a.h) <= FOV_HALF_H && Math.abs(a.v) <= FOV_HALF_V
    checks.check(
      "face and upper body in view",
      inFov(headTop) && inFov(chest),
      `headTop h=${f1(headTop.h)} v=${f1(headTop.v)}; chest h=${f1(chest.h)} v=${f1(chest.v)} (limits ±${FOV_HALF_H} / ±${FOV_HALF_V})`
    )

    checks.check("Dance/Pose panel shown", lens.actions.isShown, `actions.isShown=${lens.actions.isShown}`)
    const dance = findInteractableByName("DanceButton", undefined, true)
    const pose = findInteractableByName("PoseButton", undefined, true)
    checks.check("Dance/Pose buttons enabled", !!dance && !!pose, `DanceButton=${!!dance} PoseButton=${!!pose}`)
    log(`DC3 end :: ${lens.summary()}`)
    checks.finish()
  }
}
