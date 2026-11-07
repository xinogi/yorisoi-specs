/**
 * DeskCompanionLeafAutoRun — test-only helper that starts LEAF scenarios when the Lens starts,
 * through LEAF's own scenario manager (same code path the LEAF panel uses: registered defaults +
 * reserved params, RUNS / PASSED / FAILED lines in the log).
 *
 * Used when the LEAF panel's run tool is not reachable from the agent. `scenarioIds` is empty in
 * the saved scene, so it does nothing unless someone fills it in (comma-separated ids). Each id
 * runs in order after `startDelaySeconds`; results are printed as "[DC-AUTORUN] PASSED <id>" /
 * "[DC-AUTORUN] FAILED <id>: <reason>" plus a final summary line.
 * Never changes the lens's behavior.
 */
import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"

@component
export class DeskCompanionLeafAutoRun extends BaseScriptComponent {
  @input
  @hint("Comma-separated LEAF scenario ids to run when the Lens starts (empty = do nothing)")
  scenarioIds: string = ""

  @input
  @hint("Seconds to wait after the Lens starts before running")
  startDelaySeconds: number = 2

  onAwake(): void {
    const ids = this.scenarioIds.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    if (ids.length === 0) return
    this.createEvent("OnStartEvent").bind(() => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => {
        this.runAll(ids)
      })
      ev.reset(this.startDelaySeconds)
    })
  }

  private async runAll(ids: string[]): Promise<void> {
    const mgr = DefaultScenarioManager.getInstance()
    const results: string[] = []
    for (const id of ids) {
      print("[DC-AUTORUN] START " + id)
      try {
        const params = mgr.listScenarioParameters(id)
        await mgr.startScenario(id, ScenarioConfig.fromRecord(params))
        print("[DC-AUTORUN] PASSED " + id)
        results.push(id + "=PASS")
      } catch (e) {
        print("[DC-AUTORUN] FAILED " + id + ": " + e)
        results.push(id + "=FAIL")
      }
    }
    print("[DC-AUTORUN] SUMMARY " + results.join(" "))
  }
}
