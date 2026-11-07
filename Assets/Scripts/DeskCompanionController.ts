/**
 * DeskCompanionController — the companion's behavior: where she stands, where she walks, and
 * what she is doing. Drives the Companion root position (and an optional Facing child's yaw) and
 * asks the animator / voice / sounds to perform.
 *
 * She ALWAYS stays in front of the user, inside the narrow Specs view (learner, 2026-11-08:
 * "If I'm working at my desk, I want her always in front of my view. I don't want her behind me."):
 *   - Resting spot: `restDistanceCm` (~2.5 m) in front, `restOffsetDeg` to the right so she never
 *     covers the desk work. Inside that front zone she wanders a little (±`wanderDeg`, ±`wanderCm`).
 *   - Lazy head-follow: her spot is world-locked (she does not jitter with small head moves). If the
 *     user's view turns so she is more than `recenterThresholdDeg` away from where she should be
 *     (for a moment), she glides back to the front within `recenterSeconds` (≤ ~1.4 s, even from
 *     behind), standing on the floor plane and facing the user.
 *   - Call / word / book: she walks up to `approachDistanceCm` (~1.2 m) straight in front.
 *     Tease: to `teaseDistanceCm`. Near states keep following the head the same lazy way.
 *
 * States: roam_idle <-> roam_walk (small idle moves in the front zone) ... approach -> attend ->
 * reading | dance | pose -> attend -> leaving -> roam_idle. After `idleTeaseSeconds` with no
 * interaction (and some time roaming) she comes closer and teases you.
 *
 * Test hooks (read-only getters): state, isNear, isRecentering, distanceToUserCm,
 * angleOffCenterDeg, isInView, isWholeBodyInView.
 *
 * Inputs: animator, voice, sounds, optional facing, handAnchor, book. There are more tunables than
 * the usual 6 because her placement and timing IS the experience the learner wants to tune.
 * Must not: build UI or text (UI modules do), or read input devices directly.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionAnimator, CompanionAnim} from "./DeskCompanionAnimator"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionSounds} from "./DeskCompanionSounds"
import {DeskCompanionBook} from "./DeskCompanionBook"
import {BOOK, TEASE_LINE_IDS} from "./DeskCompanionContent"
import {angleDelta, clamp, degToRad, lerp, smoothStep01, yawAngle} from "./DeskCompanionMath"

export type CompanionState = "roam_walk" | "roam_idle" | "approach" | "attend" | "reading" | "dance" | "pose" | "leaving"
type ApproachReason = "call" | "tease" | "book" | "word"

interface Scheduled {
  at: number
  fn: () => void
}

/** Specs display field of view (brief: about 37° tall x 32° wide) — half angles, degrees. */
const FOV_HALF_H_DEG = 16
const FOV_HALF_V_DEG = 18.5
/** Height of the companion (cm) and half her body width, used for the in-view checks. */
const BODY_HEIGHT_CM = 165
const BODY_HALF_WIDTH_CM = 22
/** How long she must be off before the lazy follow kicks in (s) — ignores quick glances. */
const RECENTER_DWELL_S = 0.25

@component
export class DeskCompanionController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionController – always in front, tease, come when called, read, dance</span>')
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
  @hint("Point in front of her chest where a handed book is held")
  handAnchor: SceneObject

  @input
  @hint("The grabbable stand-in book on the desk")
  book: DeskCompanionBook
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Front zone (always in view)</span>')
  @ui.group_start("Front zone")
  @input
  @widget(new SliderWidget(150, 500, 10))
  @hint("Resting distance in front of you (cm). Brief: ~2.5 m. Whole body fits in view when you look ~14° down, or from ~4.5 m when looking level while standing.")
  restDistanceCm: number = 250

  @input
  @widget(new SliderWidget(-14, 14, 0.5))
  @hint("Resting spot angle from the center of view (deg, + = right) so she never covers the desk work")
  restOffsetDeg: number = 8

  @input
  @widget(new SliderWidget(4, 30, 1))
  @hint("Lazy follow: glide back to the front once she is this far (deg) from her spot in your view")
  recenterThresholdDeg: number = 12

  @input
  @widget(new SliderWidget(0.6, 3, 0.1))
  @hint("Longest glide back to the front (s) — used when you turned all the way around")
  recenterSeconds: number = 1.4

  @input
  @widget(new SliderWidget(0, 6, 0.5))
  @hint("Idle wandering inside the front zone: ± angle (deg)")
  wanderDeg: number = 3

  @input
  @widget(new SliderWidget(0, 60, 5))
  @hint("Idle wandering inside the front zone: ± distance (cm)")
  wanderCm: number = 30
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Behavior</span>')
  @ui.group_start("Behavior")
  @input
  @widget(new SliderWidget(5, 120, 1))
  @hint("Seconds with no interaction before she comes over to tease you")
  idleTeaseSeconds: number = 20

  @input
  @widget(new SliderWidget(30, 160, 5))
  @hint("Walking speed (cm/s) when she comes over or wanders")
  walkSpeedCmPerSec: number = 75

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
  @hint("Seconds she stays near you without interaction before stepping back to her spot")
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
  private reason: ApproachReason = "call"
  private yaw = 0
  private desiredYaw = 0
  private idleUntil = 0
  private roamSince = 0
  private stepTimer = 0
  private queue: Scheduled[] = []
  private ready = false

  // front-zone placement
  private committedYaw = 0 // polar angle (atan2(x, -z)) of the "front" she is locked to
  private wanderDTheta = 0
  private wanderDR = 0
  private offTimer = 0
  private gliding = false
  private glideT = 0
  private glideDur = 1
  private glideStartR = 0
  private glideStartTheta = 0

  private _onArrived = new Event<void>()
  private _onLeft = new Event<void>()
  private _onStateChanged = new Event<string>()
  private _onRecenter = new Event<void>()

  /** She arrived near you (≈ approachDistanceCm) and is facing you. */
  get onArrived(): PublicApi<void> { return this._onArrived.publicApi() }
  /** She stepped back from near you to her resting spot. */
  get onLeft(): PublicApi<void> { return this._onLeft.publicApi() }
  /** Every state change, with the new state name. */
  get onStateChanged(): PublicApi<string> { return this._onStateChanged.publicApi() }
  /** The lazy head-follow started gliding her back to the front. */
  get onRecenter(): PublicApi<void> { return this._onRecenter.publicApi() }

  public get state(): CompanionState { return this._state }

  /** True while she is near you and facing you (attend / reading / dance / pose). */
  public get isNear(): boolean {
    return this._state === "attend" || this._state === "reading" || this._state === "dance" || this._state === "pose"
  }

  /** True while the lazy head-follow is gliding her back to the front. */
  public get isRecentering(): boolean { return this.gliding }

  /** Horizontal distance from the user's head to her (cm). */
  public get distanceToUserCm(): number {
    const u = this.userFloor()
    const p = this.getTransform().getWorldPosition()
    return new vec3(p.x - u.x, 0, p.z - u.z).length
  }

  /** Signed horizontal angle (deg) from the center of the user's view to her (+ = right). */
  public get angleOffCenterDeg(): number {
    const u = this.userFloor()
    const p = this.getTransform().getWorldPosition()
    return (angleDelta(this.thetaOf(this.userForward()), this.thetaOf(p.sub(u))) * 180) / Math.PI
  }

  /** Her center is inside the horizontal field of view (±16°). */
  public get isInView(): boolean {
    return Math.abs(this.angleOffCenterDeg) <= FOV_HALF_H_DEG
  }

  /** Head top, feet and both sides are inside the display field of view for the current head pose. */
  public get isWholeBodyInView(): boolean {
    if (!this.camT) return false
    const p = this.getTransform().getWorldPosition()
    const pts = [
      p.add(new vec3(0, BODY_HEIGHT_CM, 0)),
      p,
      p.add(new vec3(BODY_HALF_WIDTH_CM, BODY_HEIGHT_CM * 0.55, 0)),
      p.add(new vec3(-BODY_HALF_WIDTH_CM, BODY_HEIGHT_CM * 0.55, 0))
    ]
    const inv = this.camT.getWorldRotation().invert()
    const eye = this.camT.getWorldPosition()
    for (const q of pts) {
      const d = inv.multiplyVec3(q.sub(eye))
      if (d.z >= 0) return false // behind the eye
      const h = (Math.atan2(d.x, -d.z) * 180) / Math.PI
      const v = (Math.atan2(d.y, -d.z) * 180) / Math.PI
      if (Math.abs(h) > FOV_HALF_H_DEG || Math.abs(v) > FOV_HALF_V_DEG) return false
    }
    return true
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
    // Start at her resting spot in front of wherever the user is looking.
    this.committedYaw = this.thetaOf(this.userForward())
    this.getTransform().setWorldPosition(this.polarPoint(this.userFloor(), this.restDistanceCm, this.committedYaw + degToRad(this.restOffsetDeg)))
    const p = this.getTransform().getWorldPosition()
    this.yaw = yawAngle(this.userFloor().sub(p))
    this.desiredYaw = this.yaw
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
      if (this.animator) this.animator.playOnce("wave")
      return
    }
    this.beginApproach("call")
  }

  /** She comes closer on her own and teases you. */
  public tease(): void {
    this.lastInteraction = getTime() // so she does not immediately tease again
    if (this.sounds) this.sounds.playChime()
    this.beginApproach("tease")
  }

  /** She explains a pinched word (line already chosen by the caller) and comes over if far. */
  public explainWord(lineId: string): void {
    this.noteInteraction()
    if (this.voice) this.voice.say(lineId)
    if (this._state === "reading" || this._state === "dance" || this._state === "pose") return
    if (this.isNear) return
    this.beginApproach("word")
  }

  /** The user held the book out toward her: she comes (if needed), takes it, reads, summarizes. */
  public offerBook(): void {
    this.noteInteraction()
    if (this._state === "reading") return
    if (this.isNear) {
      this.takeBook()
      return
    }
    this.beginApproach("book")
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

  private isRoamState(): boolean {
    return this._state === "roam_idle" || this._state === "roam_walk" || this._state === "leaving"
  }

  /** Where she should stand right now (polar around the user): front zone, or near spot. */
  private targetPolar(): {r: number; theta: number} {
    if (this.isRoamState()) {
      return {
        r: this.restDistanceCm + this.wanderDR,
        theta: this.committedYaw + degToRad(this.restOffsetDeg) + this.wanderDTheta
      }
    }
    const near = this.reason === "tease" ? this.teaseDistanceCm : this.approachDistanceCm
    return {r: near, theta: this.committedYaw}
  }

  private beginApproach(reason: ApproachReason): void {
    this.reason = reason
    this.gliding = false
    this.committedYaw = this.thetaOf(this.userForward())
    this.setState("approach")
  }

  private pickWander(): void {
    this.wanderDTheta = degToRad((Math.random() * 2 - 1) * this.wanderDeg)
    this.wanderDR = (Math.random() * 2 - 1) * this.wanderCm
  }

  private onArrive(): void {
    this.setState("attend")
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
    this.pickWander()
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

    // ── lazy head-follow: glide back to the front when she drifts out of her spot in view ──
    if (this._state === "approach") {
      this.committedYaw = this.thetaOf(this.userForward()) // come up in front of where you look
    } else if (this.gliding) {
      this.committedYaw = this.thetaOf(this.userForward()) // land on the current front
      this.glideT += dt / this.glideDur
      const k = smoothStep01(this.glideT)
      const tgt = this.targetPolar()
      const theta = this.glideStartTheta + angleDelta(this.glideStartTheta, tgt.theta) * k
      const r = lerp(this.glideStartR, tgt.r, k)
      const prev = this.getTransform().getWorldPosition()
      const next = this.polarPoint(this.userFloor(), r, theta)
      this.getTransform().setWorldPosition(next)
      const heading = next.sub(prev)
      if (heading.length > 0.05) this.desiredYaw = yawAngle(heading)
      this.footsteps(dt)
      anim = "walk"
      if (this.glideT >= 1) {
        this.gliding = false
        this.offTimer = 0
      }
    } else {
      const u = this.userFloor()
      const p = this.getTransform().getWorldPosition()
      const her = this.thetaOf(p.sub(u))
      const desired = this.thetaOf(this.userForward()) + (this.isRoamState() ? degToRad(this.restOffsetDeg) : 0)
      const drift = Math.abs(angleDelta(desired, her))
      this.offTimer = drift > degToRad(this.recenterThresholdDeg) ? this.offTimer + dt : 0
      if (this.offTimer > RECENTER_DWELL_S) this.startGlide()
    }

    switch (this._state) {
      case "roam_walk":
      case "approach":
      case "leaving": {
        if (this.gliding) break
        const tgt = this.targetPolar()
        const speed = this._state === "roam_walk" ? this.walkSpeedCmPerSec * 0.5 : this.walkSpeedCmPerSec
        const arrived = this.stepTowardTarget(dt, tgt.r, tgt.theta, speed)
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
        if (!this.gliding && now >= this.idleUntil) {
          this.pickWander() // a small move inside the front zone
          this.setState("roam_walk")
        }
        break
      }
      case "attend": {
        if (!this.gliding) this.faceUserNow()
        const busy = this.voice && this.voice.isSpeaking
        if (!busy && now - this.lastInteraction > this.attendSeconds) this.leave()
        break
      }
      case "reading":
        if (!this.gliding) {
          anim = "read"
          this.faceUserNow()
        }
        break
      case "dance":
      case "pose": {
        if (!this.gliding) {
          anim = this._state
          this.faceUserNow()
        }
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
    // (also needs ~8 s back at her spot, so she does not step back and turn straight around)
    const roaming = this._state === "roam_idle" || this._state === "roam_walk"
    if (roaming && !this.gliding && now - this.lastInteraction > this.idleTeaseSeconds && now - this.roamSince > 8) {
      this.tease()
    }

    // turn smoothly toward the desired yaw (only matters for an optional 3D model on `facing`)
    const turn = clamp(dt * 5, 0, 1)
    this.yaw += angleDelta(this.yaw, this.desiredYaw) * turn
    if (this.facing) this.facing.getTransform().setWorldRotation(quat.angleAxis(this.yaw, vec3.up()))

    if (this.animator) this.animator.play(anim)
  }

  /** Lazy follow kicked in: glide back to the front of the current view. */
  private startGlide(): void {
    const u = this.userFloor()
    const p = this.getTransform().getWorldPosition()
    const d = new vec3(p.x - u.x, 0, p.z - u.z)
    this.glideStartR = Math.max(1, d.length)
    this.glideStartTheta = this.thetaOf(d)
    this.committedYaw = this.thetaOf(this.userForward())
    const tgt = this.targetPolar()
    const turn = Math.abs(angleDelta(this.glideStartTheta, tgt.theta)) / Math.PI // 0..1 (1 = behind)
    this.glideDur = lerp(0.7, Math.max(0.7, this.recenterSeconds), clamp(turn, 0, 1))
    this.glideT = 0
    this.gliding = true
    this.offTimer = 0
    if (this.debugLogs) print("DeskCompanion recenter: gliding " + (turn * 180).toFixed(0) + " deg in " + this.glideDur.toFixed(2) + " s")
    this._onRecenter.invoke()
  }

  /** Walk along an arc around the user toward (r, theta). Returns true on arrival. */
  private stepTowardTarget(dt: number, targetR: number, targetTheta: number, speed: number): boolean {
    const u = this.userFloor()
    const t = this.getTransform()
    const p = t.getWorldPosition()
    const d = new vec3(p.x - u.x, 0, p.z - u.z)
    const r = Math.max(1, d.length)
    const theta = this.thetaOf(d)
    const dTheta = angleDelta(theta, targetTheta)
    const dR = targetR - r
    const pathLen = Math.sqrt(Math.pow(Math.max(r, targetR) * dTheta, 2) + dR * dR)
    if (pathLen < 4) {
      t.setWorldPosition(this.polarPoint(u, targetR, targetTheta))
      return true
    }
    const k = Math.min(1, (speed * dt) / pathLen)
    const next = this.polarPoint(u, r + dR * k, theta + dTheta * k)
    const heading = next.sub(p)
    if (heading.length > 0.01) this.desiredYaw = yawAngle(heading)
    t.setWorldPosition(next)
    this.footsteps(dt)
    return false
  }

  private footsteps(dt: number): void {
    const stepsPerSecond = this.animator ? this.animator.stepsPerSecond : 1.8
    this.stepTimer += dt
    if (this.stepTimer >= 1 / stepsPerSecond) {
      this.stepTimer = 0
      if (this.sounds) this.sounds.playFootstep()
    }
  }

  private faceUserNow(): void {
    const p = this.getTransform().getWorldPosition()
    this.desiredYaw = yawAngle(this.userFloor().sub(p))
  }

  /** After a small idle move: mostly face you, sometimes look a little aside. */
  private chooseIdleFacing(): void {
    const p = this.getTransform().getWorldPosition()
    const toUser = yawAngle(this.userFloor().sub(p))
    this.desiredYaw = Math.random() < 0.6 ? toUser : toUser + (Math.random() < 0.5 ? -1 : 1) * degToRad(30 + Math.random() * 30)
  }
}
