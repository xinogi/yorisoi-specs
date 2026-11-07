/**
 * Done criterion 2 — after a quiet stretch with no interaction she walks closer (approach ->
 * attend, ~1.5 m) and teases with a line (subtitle beside her head; voice clip if one is wired).
 *
 * The lens default is 20 s; the scenario lowers idleTeaseSeconds (parameter teaseSeconds, "3") so
 * the run is short, and restores it afterwards. The lens also requires ~8 s back at her resting
 * spot before teasing, so the tease is expected roughly 8 s after the lens starts.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CheckList, f1, Lens, log, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {findLine, TEASE_LINE_IDS} from "../Scripts/DeskCompanionContent"

const TEASE_DISTANCE_CM = 150

@component
export class DC2IdleTeaseScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const teaseSeconds = (config && config.getNumber("teaseSeconds")) || 3
    const checks = new CheckList("DC2")
    const lens = new Lens()
    const c = lens.controller
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)

    const states: string[] = []
    const lines: string[] = []
    const onState = (s: string) => {
      states.push(s)
      log(`DC2 state -> ${s} (dist=${f1(c.distanceToUserCm)})`)
    }
    const onLine = (id: string) => lines.push(id)
    c.onStateChanged.add(onState)
    lens.voice.onLineSpoken.add(onLine)

    const saved = c.idleTeaseSeconds
    c.idleTeaseSeconds = teaseSeconds
    const t0 = getTime()
    log(`DC2 idleTeaseSeconds ${saved} -> ${teaseSeconds}; waiting with no interaction :: ${lens.summary()}`)
    try {
      const approached = await waitUntil(() => states.indexOf("approach") >= 0, 20000)
      const tApproach = getTime() - t0
      checks.check("she starts walking closer (approach)", approached, `approach after ${f1(tApproach)} s of no interaction; states=${states.join(">")}`)

      const attended = await waitUntil(() => c.state === "attend", 8000)
      const tAttend = getTime() - t0
      await sleep(250)
      const ai = states.indexOf("approach")
      const ti = states.indexOf("attend")
      checks.check("approach -> attend", attended && ai >= 0 && ti > ai, `attend after ${f1(tAttend)} s; states=${states.join(">")}`)

      const d = c.distanceToUserCm
      checks.check("stops ~1.5 m away", Math.abs(d - TEASE_DISTANCE_CM) <= 5, `dist=${f1(d)} (expected 150 ± 5)`)
      checks.check("still in view", c.isInView, `angle=${f1(c.angleOffCenterDeg)}`)

      const id = lens.voice.lastLineId
      checks.check("tease line spoken", TEASE_LINE_IDS.indexOf(id) >= 0 && lines.indexOf(id) >= 0, `lastLineId=${id} lines=${lines.join(",")}`)

      const line = findLine(id)
      const shown = lens.bubble.isShown
      checks.check(
        "subtitle shown in bubble",
        shown && !!line && lens.bubble.currentJa === line.ja && lens.bubble.currentEn === line.en,
        `isShown=${shown} ja="${lens.bubble.currentJa}" en="${lens.bubble.currentEn}"`
      )

      // bubble beside her head (her root is at her feet; head ~165 cm up)
      const bubblePos = lens.bubble.getSceneObject().getTransform().getWorldPosition()
      const headPos = lens.herPos().add(new vec3(0, 165, 0))
      const gap = bubblePos.distance(headPos)
      checks.check("bubble beside her head", gap <= 50, `bubble-to-head ${f1(gap)} cm`)

      const clip = lens.voice.clipFor(id)
      log(`DC2 info: voice clip for ${id} ${clip ? "assigned" : "NOT assigned (subtitle only)"}; isSpeaking=${lens.voice.isSpeaking}`)
    } finally {
      c.idleTeaseSeconds = saved
      c.onStateChanged.remove(onState)
      lens.voice.onLineSpoken.remove(onLine)
    }
    checks.finish()
  }
}
