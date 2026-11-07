/**
 * view-desk — helper scenario (not a done criterion): tilts the head down to the desk and holds
 * it for `holdSeconds` (page, then the Call panel to the right) so a screenshot of the desk controls can be taken, then puts the head back.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LeafHead, Lens, log, waitForLensReady} from "./DeskCompanionLeafHelpers"

@component
export class ViewDeskScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const pitch = (config && config.getNumber("pitchDeg")) || -50
    const hold = (config && config.getNumber("holdSeconds")) || 10
    const lens = new Lens()
    await waitForLensReady(lens)
    const head = new LeafHead("snap", true)
    try {
      await head.turnTo(0, pitch)
      log(`VIEW-DESK holding pitch ${pitch} (page) for ${hold} s`)
      await sleep(hold * 1000)
      await head.turnTo(-30, pitch + 8)
      log(`VIEW-DESK holding yaw -30 (Call panel) for ${hold} s`)
      await sleep(hold * 1000)
    } finally {
      head.restore()
    }
  }
}
