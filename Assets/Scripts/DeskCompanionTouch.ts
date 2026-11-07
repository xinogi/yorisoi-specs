/**
 * DeskCompanionTouch — lets the user poke / pinch the companion anywhere on her body (one box
 * around her whole figure; deliberately no body-part zones) and owns her reaction mood.
 *
 *   1–2 pokes            -> "tickled": poke_tickle line + happy_laugh clip briefly
 *   4+ pokes within ~6 s -> "annoyed": poke_annoyed line + pout clip (else scold, else surprised);
 *                           further pokes are ignored for ~4 s
 *   then                 -> "forgiving": poke_forgive line + forgive clip (else idle) -> "normal"
 *
 * Owns: the touch collider + SIK Interactable (created at runtime on this SceneObject, named
 * "CompanionTouch", so LEAF can find the interactable), the poke counter and the mood state.
 * Inputs: controller (to count pokes as interaction and skip pokes while she reads), voice, animator.
 * Test hooks: pokeCount (pokes inside the current window), moodState, onPoke.
 * Must not: move her, or react while she is reading the handed book (keeps that flow intact).
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionAnimator} from "./DeskCompanionAnimator"

export type CompanionMood = "normal" | "tickled" | "annoyed" | "forgiving"

@component
export class DeskCompanionTouch extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionTouch – poke her: tickled / annoyed / forgiving</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Companion controller (pokes count as interaction; ignored while she reads)")
  controller: DeskCompanionController

  @input
  @hint("Voice + subtitles")
  voice: DeskCompanionVoice

  @input
  @hint("Animation hooks (happy_laugh / pout / scold / forgive)")
  animator: DeskCompanionAnimator
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(2, 15, 0.5))
  @hint("Pokes are counted inside this window (s)")
  pokeWindowSeconds: number = 6

  @input
  @widget(new SliderWidget(2, 10, 1))
  @hint("This many pokes inside the window make her annoyed")
  annoyedAfterPokes: number = 4

  @input
  @widget(new SliderWidget(1, 10, 0.5))
  @hint("After getting annoyed she ignores pokes for this long (s), then forgives you")
  ignoreSeconds: number = 4

  @input("vec3", "{50, 165, 24}")
  @hint("Touch box around her whole figure (cm: width, height, depth); the box sits on her feet")
  touchSizeCm: vec3
  @ui.group_end

  private pokes: number[] = []
  private mood: CompanionMood = "normal"
  private moodUntil = 0
  private _onPoke = new Event<number>()

  /** Fires on every accepted poke, with the poke count inside the window. */
  get onPoke(): PublicApi<number> { return this._onPoke.publicApi() }

  /** Pokes inside the current window. */
  public get pokeCount(): number {
    this.prune(getTime())
    return this.pokes.length
  }

  public get moodState(): CompanionMood { return this.mood }

  onAwake(): void {
    const so = this.getSceneObject()
    // Box around her figure; this object sits at her feet (child of CompanionModel, faces the user).
    let col = so.getComponent("Physics.ColliderComponent") as ColliderComponent
    if (!col) {
      col = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      const box = Shape.createBoxShape()
      box.size = this.touchSizeCm
      col.shape = box
    }
    // collider centred half her height up
    const holder = this.getTransform()
    holder.setLocalPosition(new vec3(0, this.touchSizeCm.y / 2, 0))
    let it = so.getComponent(Interactable.getTypeName()) as Interactable
    if (!it) it = so.createComponent(Interactable.getTypeName()) as Interactable

    this.createEvent("OnStartEvent").bind(() => {
      it.onTriggerStart.add((e) => {
        let by = "?"
        try {
          by = "inputType " + e.interactor.inputType
        } catch (err) {
          by = "?"
        }
        this.poke(by)
      })
    })
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** One poke (also callable from tests). */
  public poke(by: string = "code"): void {
    const now = getTime()
    if (this.mood === "annoyed") return // ignoring you for a moment
    if (this.controller && this.controller.state === "reading") return
    this.prune(now)
    this.pokes.push(now)
    if (this.controller) this.controller.noteInteraction()
    const n = this.pokes.length
    this._onPoke.invoke(n)
    print("DeskCompanionTouch: poke " + n + " (mood " + this.mood + ", by " + by + ")")
    if (n >= this.annoyedAfterPokes) {
      this.setMood("annoyed", now + this.ignoreSeconds)
      if (this.voice) this.voice.say("poke_annoyed")
      if (this.animator) this.animator.playOnce("pout")
      return
    }
    if (n <= 2) {
      if (this.voice) this.voice.say("poke_tickle")
    }
    if (this.animator) this.animator.playOnce("happy_laugh")
    this.setMood("tickled", now + 2.5)
  }

  private tick(): void {
    const now = getTime()
    if (this.mood === "annoyed" && now >= this.moodUntil) {
      this.pokes = []
      this.setMood("forgiving", now + 3)
      if (this.voice) this.voice.say("poke_forgive")
      if (this.animator) this.animator.playOnce("forgive")
    } else if ((this.mood === "tickled" || this.mood === "forgiving") && now >= this.moodUntil) {
      this.setMood("normal", 0)
    }
  }

  private setMood(m: CompanionMood, until: number): void {
    if (m !== this.mood) print("DeskCompanionTouch: mood " + this.mood + " -> " + m)
    this.mood = m
    this.moodUntil = until
  }

  private prune(now: number): void {
    const w = this.pokeWindowSeconds
    this.pokes = this.pokes.filter((t) => now - t < w)
  }
}
