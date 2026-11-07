/**
 * DeskCompanionController — the companion's behavior: where she is, where she walks, and
 * what she is doing. Drives the Companion root (position) and its Facing child (yaw), and asks
 * the animator / voice / sounds to perform.
 *
 * States: roam_walk -> roam_idle (her own idle actions 1.5–3 m away, front and sides, sometimes
 * facing away) ... approach (called / teasing / to take a book / after a word) -> attend (about
 * 1.2 m in front of you, facing you) -> reading | dance | pose -> attend -> leaving -> roam.
 * After `idleTeaseSeconds` with no interaction while roaming, she comes closer and teases you.
 *
 * Movement is polar around the user (she arcs around you instead of cutting through the desk).
 *
 * Inputs: animator, voice, sounds, facing (yaw node), handAnchor (where a handed book sits), book.
 * Tunables are grouped in Settings; there are a few more than the usual 6 because her behavior
 * (timings + distances) IS the experience the learner wants to tune.
 *
 * Must not: build UI or text (the UI modules do), or read input devices directly.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionAnimator, CompanionAnim} from "./DeskCompanionAnimator"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionSounds} from "./DeskCompanionSounds"
import {DeskCompanionBook} from "./DeskCompanionBook"
import {BOOK, TEASE_LINE_IDS} from "./DeskCompanionContent"
import {angleDelta, clamp, degToRad, yawAngle} from "./DeskCompanionMath"

export type CompanionState = "roam_walk" | "roam_idle" | "approach" | "attend" | "reading" | "dance" | "pose" | "leaving"
type ApproachReason = "call" | "tease" | "book" | "word"

interface Scheduled {
  at: number
  fn: () => void
}

@component
export class DeskCompanionController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionController – roam, tease, come when called, read, dance</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Animation hooks for the model")
  animator: DeskCompanionAnimator

  @input
  @hint("Voice + subtitles")
  voice: DeskCompanionVoice

  @input
  @hint("Spatial footsteps and small sounds")
  sounds: DeskCompanionSounds

  @input
  @allowUndefined
  @hint("Optional: a child that holds a 3D model and should yaw toward where she walks. Leave empty for the video card (it billboards to you on its own).")
  facing: SceneObject

  @input
  @hint("Point in front of her chest where a handed book is held (child of Facing)")
  handAnchor: SceneObject

  @input
  @hint("The grabbable stand-in book on the desk")
  book: DeskCompanionBook
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(5, 120, 1))
  @hint("Seconds with no interaction before she comes over to tease you")
  idleTeaseSeconds: number = 20

  @input
  @widget(new SliderWidget(30, 160, 5))
  @hint("Walking speed (cm/s)")
  walkSpeedCmPerSec: number = 75

  @input
  @widget(new SliderWidget(100, 400, 10))
  @hint("Closest roaming distance from you (cm)")
  roamMinDistanceCm: number = 150

  @input
  @widget(new SliderWidget(120, 500, 10))
  @hint("Farthest roaming distance from you (cm)")
  roamMaxDistanceCm: number = 300

  @input
  @widget(new SliderWidget(80, 250, 5))
  @hint("Where she stops in front of you when called (cm)")
  approachDistanceCm: number = 120

  @input
  @widget(new SliderWidget(90, 300, 5))
  @hint("Where she stops when she comes over to tease (cm)")
  teaseDistanceCm: number = 150

  @input
  @widget(new SliderWidget(3, 60, 1))
  @hint("Seconds she stays near you without interaction before wandering off again")
  attendSeconds: number = 15

  @input
  @hint("Print each state change to the Logger")
  debugLogs: boolean = true
  @ui.group_end

  private camT: Transform | null = null
  private floorY = 0
  private _state: CompanionState = "roam_idle"
  private stateStart = 0
  private lastInteraction = 0
  private targetR = 200
  private targetTheta = 0
  private reason: ApproachReason = "call"
  private yaw = 0
  private desiredYaw = 0
  private idleUntil = 0
  private roamSince = 0
  private stepTimer = 0
  private queue: Scheduled[] = []
  private ready = false

  private _onArrived = new Event<void>()
  private _onLeft = new Event<void>()
  private _onStateChanged = new Event<string>()

  /** She arrived near you (≈ approachDistanceCm) and is facing you. */
  get onArrived(): PublicApi<void> { return this._onArrived.publicApi() }
  /** She started walking away (no longer near you). */
  get onLeft(): PublicApi<void> { return this._onLeft.publicApi() }
  /** Every state change, with the new state name. */
  get onStateChanged(): PublicApi<string> { return this._onStateChanged.publicApi() }

  public get state(): CompanionState { return this._state }

  /** True while she is near you and facing you (attend / reading / dance / pose). */
  public get isNear(): boolean {
    return this._state === "attend" || this._state === "reading" || this._state === "dance" || this._state === "pose"
  }

  /** Horizontal distance from the user's head to her (cm). */
  public get distanceToUserCm(): number {
    const u = this.userFloor()
    const p = this.getTransform().getWorldPosition()
    return new vec3(p.x - u.x, 0, p.z - u.z).length
  }

  public get secondsSinceInteraction(): number {
    return getTime() - this.lastInteraction
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private start(): void {
    this.camT = WorldCameraFinderProvider.getInstance().getTransform()
    this.floorY = this.getTransform().getWorldPosition().y
    if (!this.animator || !this.voice) {
      print("DeskCompanionController: animator / voice not wired — check the scene")
    }
    const now = getTime()
    this.lastInteraction = now
    const p = this.getTransform().getWorldPosition()
    const u = this.userFloor()
    this.yaw = yawAngle(u.sub(p))
    this.desiredYaw = this.yaw + degToRad(70) // start looking off to the side, doing her own thing
    this.idleUntil = now + 3
    this.roamSince = now
    this.setState("roam_idle")
    this.ready = true
  }

  // ───────────────────────────── Public commands (called by DeskCompanionMain) ─────────────────────────────

  /** Any user interaction resets the tease timer. */
  public noteInteraction(): void {
    this.lastInteraction = getTime()
  }

  /** "I called her": she says "What's up?" and walks up to about 1.2 m in front. */
  public callOver(): void {
    this.noteInteraction()
    if (this._state === "reading" || this._state === "dance" || this._state === "pose") return
    if (this.sounds) this.sounds.playChime()
    if (this.voice) this.voice.say("call_whats_up")
    if (this.isNear) {
      this.faceUserNow()
      if (this.animator) this.animator.playOnce("wave")
      return
    }
    this.beginApproach("call", this.approachDistanceCm)
  }

  /** She comes closer on her own and teases you. */
  public tease(): void {
    this.lastInteraction = getTime() // so she does not immediately tease again
    if (this.sounds) this.sounds.playChime()
    this.beginApproach("tease", this.teaseDistanceCm)
  }

  /** She explains a pinched word (line already chosen by the caller) and comes over if far. */
  public explainWord(lineId: string): void {
    this.noteInteraction()
    if (this.voice) this.voice.say(lineId)
    if (this._state === "reading" || this._state === "dance" || this._state === "pose") return
    if (this.isNear) {
      this.faceUserNow()
      return
    }
    this.beginApproach("word", this.approachDistanceCm)
  }

  /** The user held the book out toward her: she comes (if needed), takes it, reads, summarizes. */
  public offerBook(): void {
    this.noteInteraction()
    if (this._state === "reading") return
    if (this.isNear) {
      this.takeBook()
      return
    }
    this.beginApproach("book", this.approachDistanceCm)
  }

  /** Dance (only while she is near you). Returns false if she can't right now. */
  public dance(): boolean {
    this.noteInteraction()
    if (this._state !== "attend") return false
    if (this.voice) this.voice.say("dance")
    if (this.sounds) this.sounds.playSparkle()
    this.setState("dance") // ends when the dance clip / one-shot finishes (see tick)
    return true
  }

  /** Strike a pose (only while she is near you). Returns false if she can't right now. */
  public pose(): boolean {
    this.noteInteraction()
    if (this._state !== "attend") return false
    if (this.voice) this.voice.say("pose")
    if (this.sounds) this.sounds.playSparkle()
    this.setState("pose") // ends when the pose clip / one-shot finishes (see tick)
    return true
  }

  // ───────────────────────────── Internals ─────────────────────────────

  private setState(s: CompanionState): void {
    if (s === this._state && this.ready) return
    const prev = this._state
    this._state = s
    this.stateStart = getTime()
    if (this.debugLogs) print("DeskCompanion state: " + prev + " -> " + s)
    this._onStateChanged.invoke(s)
  }

  private schedule(delaySec: number, fn: () => void): void {
    this.queue.push({at: getTime() + delaySec, fn})
  }

  private userFloor(): vec3 {
    if (!this.camT) return new vec3(0, this.floorY, 0)
    const c = this.camT.getWorldPosition()
    return new vec3(c.x, this.floorY, c.z)
  }

  /** Flattened view direction of the user (falls back to world -Z when looking straight down). */
  private userForward(): vec3 {
    if (!this.camT) return new vec3(0, 0, -1)
    const f = this.camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(f.x, 0, f.z)
    return flat.length > 0.2 ? flat.normalize() : new vec3(0, 0, -1)
  }

  /** Polar angle of a flat offset, measured from world -Z toward +X (radians). */
  private thetaOf(d: vec3): number {
    return Math.atan2(d.x, -d.z)
  }

  private polarPoint(center: vec3, r: number, theta: number): vec3 {
    return new vec3(center.x + Math.sin(theta) * r, this.floorY, center.z - Math.cos(theta) * r)
  }

  private beginApproach(reason: ApproachReason, distance: number): void {
    // a call / book outranks a tease that is already under way
    this.reason = reason
    this.targetR = distance
    this.targetTheta = this.thetaOf(this.userForward())
    this.setState("approach")
  }

  private pickRoamTarget(): void {
    const u = this.userFloor()
    const p = this.getTransform().getWorldPosition()
    const theta = this.thetaOf(p.sub(u))
    const span = degToRad(115)
    // Specs' display is narrow, so favour the front sector (in view) but still visit the sides.
    let t = 0
    for (let i = 0; i < 6; i++) {
      t = Math.random() < 0.55 ? degToRad(-30 + Math.random() * 60) : (Math.random() < 0.5 ? -1 : 1) * degToRad(40 + Math.random() * 75)
      if (Math.abs(angleDelta(theta, t)) > degToRad(25)) break // make it a visible move
    }
    this.targetTheta = clamp(t, -span, span)
    this.targetR = this.roamMinDistanceCm + Math.random() * Math.max(0, this.roamMaxDistanceCm - this.roamMinDistanceCm)
  }

  private faceUserNow(): void {
    const p = this.getTransform().getWorldPosition()
    this.desiredYaw = yawAngle(this.userFloor().sub(p))
  }

  private onArrive(): void {
    this.setState("attend")
    this.faceUserNow()
    this._onArrived.invoke()
    if (this.reason === "tease") {
      const id = TEASE_LINE_IDS[Math.floor(Math.random() * TEASE_LINE_IDS.length)]
      if (this.animator) this.animator.playOnce("lean_in")
      if (this.voice) this.voice.say(id)
    } else if (this.reason === "book") {
      this.takeBook()
    } else if (this.reason === "call") {
      if (this.animator) this.animator.playOnce("wave")
    }
  }

  private takeBook(): void {
    if (!this.book || !this.handAnchor) return
    this.setState("reading")
    this.faceUserNow()
    const d1 = this.voice ? this.voice.say(BOOK.receivedLineId) : 2
    this.book.flyTo(this.handAnchor, 0.7, () => {
      this.book.setOpen(true)
      if (this.sounds) this.sounds.playPageFlip()
    })
    this.schedule(Math.max(d1, 1.8) + 1.2, () => {
      const d2 = this.voice ? this.voice.say(BOOK.summaryLineId) : 6
      this.schedule(d2 + 1.0, () => {
        this.book.setOpen(false)
        if (this.voice) this.voice.say(BOOK.returnLineId)
        this.schedule(0.8, () => {
          this.book.returnHome()
          this.noteInteraction()
          if (this._state === "reading") this.setState("attend")
        })
      })
    })
  }

  private leave(): void {
    if (this.voice) this.voice.say("leave")
    this.pickRoamTarget()
    this.roamSince = getTime()
    this.setState("leaving")
    this._onLeft.invoke()
  }

  private tick(): void {
    if (!this.ready) return
    const now = getTime()
    const dt = getDeltaTime()

    // run scheduled actions
    if (this.queue.length > 0) {
      const due = this.queue.filter((q) => q.at <= now)
      this.queue = this.queue.filter((q) => q.at > now)
      for (const q of due) q.fn()
    }

    let anim: CompanionAnim = this.voice && this.voice.isSpeaking ? "talk" : "idle"

    switch (this._state) {
      case "roam_walk":
      case "approach":
      case "leaving": {
        // keep the approach target in front of the user as they turn
        if (this._state === "approach") this.targetTheta = this.thetaOf(this.userForward())
        const arrived = this.stepTowardTarget(dt)
        if (!arrived) anim = "walk" // on the arrival frame keep idle/talk so a wave / lean-in is not cancelled
        if (arrived) {
          if (this._state === "approach") {
            this.onArrive()
          } else {
            this.idleUntil = now + 4 + Math.random() * 5
            this.chooseIdleFacing()
            this.setState("roam_idle")
          }
        }
        break
      }
      case "roam_idle": {
        if (now >= this.idleUntil) {
          this.pickRoamTarget()
          this.setState("roam_walk")
        }
        break
      }
      case "attend": {
        this.faceUserNow()
        const busy = this.voice && this.voice.isSpeaking
        if (!busy && now - this.lastInteraction > this.attendSeconds) this.leave()
        break
      }
      case "reading":
        anim = "read"
        this.faceUserNow()
        break
      case "dance":
      case "pose": {
        anim = this._state
        this.faceUserNow()
        const elapsed = now - this.stateStart
        const clipDone = elapsed > 0.6 && this.animator && this.animator.currentAnim !== this._state
        if (clipDone || elapsed > 20) {
          this.setState("attend")
          this.noteInteraction()
        }
        break
      }
    }

    // quiet for a while while roaming -> come over and tease
    // (also needs ~8 s of roaming, so she does not walk away and turn straight back)
    const roaming = this._state === "roam_idle" || this._state === "roam_walk"
    if (roaming && now - this.lastInteraction > this.idleTeaseSeconds && now - this.roamSince > 8) {
      this.tease()
    }

    // turn smoothly toward the desired yaw
    const turn = clamp(dt * 5, 0, 1)
    this.yaw += angleDelta(this.yaw, this.desiredYaw) * turn
    if (this.facing) this.facing.getTransform().setWorldRotation(quat.angleAxis(this.yaw, vec3.up()))

    if (this.animator) this.animator.play(anim)
  }

  /** Move along an arc around the user toward (targetR, targetTheta). Returns true on arrival. */
  private stepTowardTarget(dt: number): boolean {
    const u = this.userFloor()
    const t = this.getTransform()
    const p = t.getWorldPosition()
    const d = new vec3(p.x - u.x, 0, p.z - u.z)
    const r = Math.max(1, d.length)
    const theta = this.thetaOf(d)
    const dTheta = angleDelta(theta, this.targetTheta)
    const dR = this.targetR - r
    const pathLen = Math.sqrt(Math.pow(Math.max(r, this.targetR) * dTheta, 2) + dR * dR)
    if (pathLen < 4) {
      t.setWorldPosition(this.polarPoint(u, this.targetR, this.targetTheta))
      return true
    }
    const k = Math.min(1, (this.walkSpeedCmPerSec * dt) / pathLen)
    const next = this.polarPoint(u, r + dR * k, theta + dTheta * k)
    const heading = next.sub(p)
    if (heading.length > 0.01) this.desiredYaw = yawAngle(heading)
    t.setWorldPosition(next)

    const stepsPerSecond = this.animator ? this.animator.stepsPerSecond : 1.8
    this.stepTimer += dt
    if (this.stepTimer >= 1 / stepsPerSecond) {
      this.stepTimer = 0
      if (this.sounds) this.sounds.playFootstep()
    }
    return false
  }

  /** After arriving at a roam spot: face you, look sideways, or turn away for a while. */
  private chooseIdleFacing(): void {
    const p = this.getTransform().getWorldPosition()
    const toUser = yawAngle(this.userFloor().sub(p))
    const r = Math.random()
    if (r < 0.4) this.desiredYaw = toUser
    else if (r < 0.8) this.desiredYaw = toUser + (Math.random() < 0.5 ? -1 : 1) * degToRad(80 + Math.random() * 30)
    else this.desiredYaw = toUser + Math.PI // facing away, doing her own thing
  }
}
