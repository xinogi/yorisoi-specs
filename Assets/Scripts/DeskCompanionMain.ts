/**
 * DeskCompanionMain — orchestration table for the Desk Companion lens. Reads like a wiring diagram:
 *
 *   Call button pinched        -> companion.callOver()            ("What's up?" + walks to ~1.2 m)
 *   Highlighted word pinched   -> page.showTranslation(..) next to the word + companion.explainWord(line)
 *   Book grabbed / offered     -> companion.noteInteraction() / companion.offerBook() (reads + summarizes)
 *   Dance / Pose pinched       -> companion.dance() / companion.pose()
 *   Mode pinched               -> modes.cycleMode()   (persona modes + cue cards live in DeskCompanionModeController)
 *   Ask pinched                -> modes.ask()         (weather / today's plan / project tip, sample data)
 *   Word pinched (also)        -> translator.translateWord() -> page.setTranslationResult() (live / offline)
 *   Translate… pinched         -> translator.openFreeInput()  (AR keyboard -> live translation card)
 *   Companion arrived / left   -> actions.show() / actions.hide()
 *
 * Owns: event wiring only, the UI click sound, and making sure the camera has an AudioListener
 * (required for her spatial voice / footsteps).
 * Inputs: the authored controller, book, and the three desk/companion UI modules.
 * Must not: hold companion state (DeskCompanionController owns it) or build UI/text (UI modules do).
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionBook} from "./DeskCompanionBook"
import {DeskCompanionCallButtonUI} from "./DeskCompanionCallButtonUI"
import {DeskCompanionForeignPageUI} from "./DeskCompanionForeignPageUI"
import {DeskCompanionActionsUI} from "./DeskCompanionActionsUI"
import {DeskCompanionModeController} from "./DeskCompanionModeController"
import {DeskCompanionTranslator} from "./DeskCompanionTranslator"
import {findWord} from "./DeskCompanionContent"

@component
export class DeskCompanionMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionMain – wires the desk stand-ins to the companion</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The companion's behavior controller (on the Companion root)")
  companion: DeskCompanionController

  @input
  @hint("Big Call button on the desk")
  callButton: DeskCompanionCallButtonUI

  @input
  @hint("Stand-in foreign-language page on the desk")
  page: DeskCompanionForeignPageUI

  @input
  @hint("Dance / Pose panel that appears near her")
  actions: DeskCompanionActionsUI

  @input
  @hint("Grabbable stand-in book on the desk")
  book: DeskCompanionBook

  @input
  @hint("Persona modes + cue cards (Mode button)")
  modes: DeskCompanionModeController

  @input
  @hint("Live translation (MyMemory) with the hard-coded table as fallback")
  translator: DeskCompanionTranslator

  @input
  @allowUndefined
  @hint("Non-spatial AudioComponent for UI clicks")
  uiClickAudio: AudioComponent

  @input
  @allowUndefined
  @hint("Click sound for desk buttons and word pinches")
  uiClickSound: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Wireframe every collider in the scene (takes effect on preview restart)")
  debugColliders: boolean = false
  @ui.group_end

  onAwake(): void {
    if (!this.companion || !this.callButton || !this.page || !this.actions || !this.book || !this.modes) {
      print("DeskCompanionMain: a required @input is not wired (companion / callButton / page / actions / book / modes). Check the scene.")
      return
    }
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    this.ensureAudioListener()
    if (this.uiClickAudio) this.uiClickAudio.playbackMode = Audio.PlaybackMode.LowLatency

    this.callButton.onCall.add(() => {
      this.click()
      print("DeskCompanionMain: Call pinched")
      this.companion.callOver()
    })

    this.page.onWordPinched.add((wordId: string) => {
      const w = findWord(wordId)
      if (!w) return
      this.click()
      print("DeskCompanionMain: word pinched " + wordId)
      this.page.showTranslation(w.id, w.word, w.reading, w.meaningJa, w.meaningEn)
      this.companion.explainWord(w.lineId)
      if (this.translator) {
        this.translator.translateWord(w).then((r) => this.page.setTranslationResult(w.id, r.meaningEn, r.meaningJa, r.source))
      }
    })

    this.book.onGrabbed.add(() => this.companion.noteInteraction())
    this.book.onOffered.add(() => this.companion.offerBook())

    this.actions.onDance.add(() => {
      this.click()
      this.companion.dance()
    })
    this.actions.onPose.add(() => {
      this.click()
      this.companion.pose()
    })
    this.actions.onMode.add(() => {
      this.click()
      this.modes.cycleMode()
    })
    this.actions.onAsk.add(() => {
      this.click()
      this.modes.ask()
    })
    this.actions.onTranslate.add(() => {
      this.click()
      if (this.translator) this.translator.openFreeInput()
    })
    // the Ask card and the translation card share the spot beside her head: one hides the other
    this.modes.onAskShown = () => {
      if (this.translator) this.translator.hideCard()
    }
    if (this.translator) this.translator.onCardShown.add(() => this.modes.hideAskCard())

    this.companion.onArrived.add(() => this.actions.show())
    this.companion.onLeft.add(() => this.actions.hide())

    if (this.debugColliders) {
      for (let i = 0; i < global.scene.getRootObjectsCount(); i++) this.setColliderDebugAll(global.scene.getRootObject(i), true)
    }
  }

  private click(): void {
    if (!this.uiClickAudio || !this.uiClickSound) return
    try {
      if (this.uiClickAudio.isPlaying()) this.uiClickAudio.stop(false)
      this.uiClickAudio.audioTrack = this.uiClickSound
      this.uiClickAudio.play(1)
    } catch (e) {
      print("DeskCompanionMain: click sound failed: " + e)
    }
  }

  /** Spatial audio needs an Audio Listener on the camera; add one if the scene lacks it. */
  private ensureAudioListener(): void {
    const camSO = WorldCameraFinderProvider.getInstance().getComponent().getSceneObject()
    if (!camSO.getComponent("Component.AudioListenerComponent")) {
      camSO.createComponent("Component.AudioListenerComponent")
      print("DeskCompanionMain: added AudioListener to the camera for spatial audio")
    }
  }

  private setColliderDebugAll(so: SceneObject, on: boolean): void {
    const cols = so.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of cols) c.debugDrawEnabled = on
    for (let i = 0; i < so.getChildrenCount(); i++) this.setColliderDebugAll(so.getChild(i), on)
  }
}
