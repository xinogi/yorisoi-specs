/**
 * Done criterion 5 — grabbing the book on the desk and handing it to her makes her open it and give
 * a short summary (book_received -> book_summary -> book_return), then the book comes back to the
 * desk and she returns to attend.
 *
 * Parameter handoffMode:
 *   "holdOut"   (default) carry the book ~60 cm out along the line of sight to her chest and let go
 *               (the "held out toward her" rule), like a seated user stretching out an arm;
 *   "nearChest" carry it to 40 cm in front of her chest and let go (the "within 80 cm" rule).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CheckList, f1, Lens, log, waitForLensReady, waitUntil} from "./DeskCompanionLeafHelpers"
import {DeskCompanionLeafInteractor, vecStr} from "./DeskCompanionLeafInteractor"
import {BOOK} from "../Scripts/DeskCompanionContent"

@component
export class DC5BookHandoffScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const mode = (config && config.get("handoffMode")) || "holdOut"
    const checks = new CheckList("DC5")
    const lens = new Lens()
    const c = lens.controller
    const book = lens.book
    expect(await waitForLensReady(lens), "lens never placed the companion").toBe(true)
    expect(await waitUntil(() => !!findInteractableByName("Book", undefined, true), 5000), "Book interactable never appeared").toBe(true)
    await sleep(800)

    const bookT = book.getSceneObject().getTransform()
    const home = bookT.getWorldPosition()
    const eye = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const chest = lens.herPos().add(new vec3(0, 118, 0))
    let dest: vec3
    if (mode === "nearChest") {
      dest = chest.add(eye.sub(chest).normalize().uniformScale(40))
    } else {
      dest = eye.add(chest.sub(eye).normalize().uniformScale(60))
    }
    log(`DC5 mode=${mode} home=${vecStr(home)} chest=${vecStr(chest)} dest=${vecStr(dest)} :: ${lens.summary()}`)
    checks.check("book starts on the desk, not with her", !book.isWithCompanion && !book.isOpen, `withCompanion=${book.isWithCompanion} open=${book.isOpen}`)

    const lines: Array<{id: string; t: number}> = []
    const states: string[] = []
    const onLine = (id: string) => lines.push({id, t: getTime()})
    const onState = (s: string) => {
      states.push(s)
      log(`DC5 state -> ${s} (dist=${f1(c.distanceToUserCm)})`)
    }
    lens.voice.onLineSpoken.add(onLine)
    c.onStateChanged.add(onState)
    try {
      const interactor = new DeskCompanionLeafInteractor()
      let grabbed = false
      const onGrab = () => (grabbed = true)
      book.onGrabbed.add(onGrab)
      let offered = false
      const onOffer = () => (offered = true)
      book.onOffered.add(onOffer)

      const r = await interactor.grabMoveTo("Book", dest, mode === "nearChest" ? 150 : 60)
      book.onGrabbed.remove(onGrab)
      const moved = r.releasedAt.distance(home)
      const toChest = r.releasedAt.distance(lens.herPos().add(new vec3(0, 118, 0)))
      checks.check("book grabbed", grabbed, `onGrabbed fired=${grabbed}`)
      checks.check("book carried to the hand-off point", r.reached, `released at ${vecStr(r.releasedAt)}; moved ${f1(moved)} cm; ${f1(toChest)} cm from her chest`)

      await sleep(200)
      book.onOffered.remove(onOffer)
      checks.check("release counts as handing it to her", offered, `onOffered fired=${offered}`)
      const tRelease = getTime()

      const reading = await waitUntil(() => c.state === "reading", 8000)
      const tReading = getTime()
      checks.check("she takes it: state reading", reading, `state=${c.state} ${f1(tReading - tRelease)} s after release; states=${states.join(">")}`)
      checks.check("book is with her", book.isWithCompanion, `withCompanion=${book.isWithCompanion}`)
      const opened = await waitUntil(() => book.isOpen, 2500)
      checks.check("she opens it", opened, `isOpen=${book.isOpen}`)

      const gotReturn = await waitUntil(() => lines.some((l) => l.id === BOOK.returnLineId), 25000)
      const ids = lines.map((l) => l.id)
      const iRecv = ids.indexOf(BOOK.receivedLineId)
      const iSum = ids.indexOf(BOOK.summaryLineId)
      const iRet = ids.indexOf(BOOK.returnLineId)
      const tSum = iSum >= 0 ? lines[iSum].t - tReading : -1
      checks.check(
        "lines book_received -> book_summary -> book_return",
        gotReturn && iRecv >= 0 && iSum > iRecv && iRet > iSum,
        `lines=${ids.join(",")} (summary at +${f1(tSum)} s)`
      )

      const back = await waitUntil(() => c.state === "attend" && !book.isWithCompanion, 10000)
      const tBack = getTime() - tReading
      const homeGap = bookT.getWorldPosition().distance(home)
      checks.check("book back on the desk and state attend", back && homeGap < 2, `after ${f1(tBack)} s of reading: state=${c.state} withCompanion=${book.isWithCompanion} book-to-home ${f1(homeGap)} cm`)
      checks.check("book closed again", !book.isOpen, `isOpen=${book.isOpen}`)
      checks.check("return about 15 s after she took it", tBack >= 10 && tBack <= 20, `${f1(tBack)} s`)
    } finally {
      lens.voice.onLineSpoken.remove(onLine)
      c.onStateChanged.remove(onState)
    }
    log(`DC5 end :: ${lens.summary()}`)
    checks.finish()
  }
}
