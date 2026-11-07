/**
 * Done criterion 3 — pinching the Call button makes her say the active mode's call line (default
 * Sweetheart: "Hey, what's up?" / どうしたの？ — line id comes from controller.callLineId) and walk up
 * to ~1.2 m in front, face and upper body in view; the Dance/Pose panel appears near her.
 * Also: the desk Voice slider at 0 silences the voice AudioComponent, Mute / Unmute work, and
 * "Yori: Voice only" hides her body (light dot instead) while Call still answers.
 *
 * Parameter: arriveLimitMs = "2500" (how long she may take to arrive after the pinch).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CheckList, f1, FOV_HALF_H, FOV_HALF_V, Lens, log, viewAngles, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {LeafHead} from "./DeskCompanionLeafHelpers"
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
    // an earlier scenario may have left her up close (e.g. after a tease): send her back first
    if (c.isNear) {
      c.returnToSpot(false)
      await waitUntil(() => !c.isNear && (c.state === "roam_idle" || c.state === "roam_walk"), 8000)
      await sleep(300)
    }
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

    // face and upper body in view with the head level (the preview camera may have been tilted by
    // hand before the run, so level it first — same yaw, pitch 0 — and put it back afterwards)
    const head = new LeafHead("snap", true)
    const pitchBefore = head.pitchDeg()
    await head.turnTo(head.yawDeg(), 0)
    await sleep(100)
    log(`DC3 head levelled for the view check (pitch ${f1(pitchBefore)} -> ${f1(head.pitchDeg())})`)
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
    head.restore()

    checks.check("Dance/Pose panel shown", lens.actions.isShown, `actions.isShown=${lens.actions.isShown}`)
    const dance = findInteractableByName("DanceButton", undefined, true)
    const pose = findInteractableByName("PoseButton", undefined, true)
    checks.check("Dance/Pose buttons enabled", !!dance && !!pose, `DanceButton=${!!dance} PoseButton=${!!pose}`)

    // voice volume on the desk: slider to 0 -> voice AudioComponent volume 0; Mute / Unmute
    const sliderSO = findSceneObjectByName("VoiceSlider")
    const slider = sliderSO ? (sliderSO.getComponent(Slider.getTypeName() as any) as unknown as Slider) : null
    if (!slider) {
      checks.check("Voice slider on the desk", false, "VoiceSlider not found")
    } else {
      const v0 = lens.voice.voiceVolume
      slider.currentValue = 0
      await sleep(100)
      const audio = lens.voice.voiceAudio
      checks.check("Voice slider 0 -> voice volume 0", lens.voice.voiceVolume === 0 && !!audio && audio.volume === 0, `voiceVolume=${lens.voice.voiceVolume} audio.volume=${audio ? audio.volume : "?"}`)
      slider.currentValue = v0
      await sleep(100)
      await interactor.tap("MuteButton")
      await sleep(100)
      const mutedOk = lens.voice.muted && audio.volume === 0
      await interactor.tap("MuteButton")
      await sleep(100)
      checks.check("Mute / Unmute", mutedOk && !lens.voice.muted && Math.abs(audio.volume - v0) < 0.01, `muted then unmuted; volume back to ${f1(audio.volume * 100)} % (was ${f1(v0 * 100)} %)`)
    }

    // Yori: Voice only -> VideoCard hidden, the light dot shows, Call still answers; then back
    await interactor.tap("AvatarButton")
    await sleep(150)
    const cardSO = findSceneObjectByName("VideoCard")
    const dotSO = findSceneObjectByName("VoiceDot")
    const hidden = !c.avatarVisible && !!cardSO && !cardSO.enabled && !!dotSO && dotSO.enabled
    const linesBefore = lens.voice.lastLineId
    await interactor.tap("CallButton")
    await sleep(150)
    checks.check("Voice only: body hidden, dot shown, Call still answers", hidden && lens.voice.lastLineId === c.callLineId,
      `avatarVisible=${c.avatarVisible} VideoCard.enabled=${cardSO ? cardSO.enabled : "?"} VoiceDot=${dotSO ? dotSO.enabled : "missing"} line ${linesBefore} -> ${lens.voice.lastLineId}`)
    await interactor.tap("AvatarButton")
    await sleep(150)
    checks.check("Yori: Visible again", c.avatarVisible && !!cardSO && cardSO.enabled && !!dotSO && !dotSO.enabled, `avatarVisible=${c.avatarVisible}`)
    log(`DC3 end :: ${lens.summary()}`)
    checks.finish()
  }
}
