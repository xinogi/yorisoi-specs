/**
 * DeskCompanionAnimator — the companion's animation hooks:
 *   idle, walk, talk (loop)   ·   wave, lean_in, read, dance, pose, happy_laugh, surprised,
 *   thoughtful (play once — capped at a few seconds per hook, since the clips are 10 s — then idle)
 *
 * Owns: what the CompanionModel subtree shows. Never moves the Companion root (the controller does).
 *
 * Strategy, chosen once at start (first that applies wins):
 *   1. "video"  — `videoCard` + `idleVideo` are set: the photoreal video character. Each hook swaps
 *                 the card material's baseTex to that hook's VideoTexture and plays it (loop or once).
 *                 Plug in real clips by overwriting Assets/Companion/Clips/<name>.mp4 (same file name
 *                 keeps the wiring) or by dropping new VideoTextures on the slots below.
 *   2. "clip"   — an AnimationPlayer under the model has clips whose names contain the hook names.
 *   3. "joints" — the model has joints named Hips / Spine / Head / LeftUpperArm / LeftForearm /
 *                 RightUpperArm / RightForearm / LeftLeg / RightLeg: animated procedurally.
 *   4. "tween"  — anything else (e.g. a static mesh): bob / tilt / spin the whole model.
 * Missing hooks degrade: pose -> dance -> idle, lean_in -> talk -> idle, thoughtful -> talk -> idle,
 * happy_laugh -> wave -> idle, pout -> scold -> surprised -> idle, forgive -> idle, others -> idle.
 *
 * Must not: decide WHEN to play anything (DeskCompanionController does), talk, or touch UI.
 */
import {clamp, degToRad, lerp} from "./DeskCompanionMath"

export type CompanionAnim =
  | "idle" | "walk" | "talk" | "read" | "dance" | "pose" | "wave" | "lean_in"
  | "happy_laugh" | "surprised" | "thoughtful" | "pout" | "scold" | "forgive"

const LOOP_HOOKS: CompanionAnim[] = ["idle", "walk", "talk"]
const ALL_HOOKS: CompanionAnim[] = [
  "idle", "walk", "talk", "read", "dance", "pose", "wave", "lean_in", "happy_laugh", "surprised", "thoughtful", "pout", "scold", "forgive"
]

/** Longest time (s) a play-once hook stays on screen before returning to idle (clips are ~10 s). */
const ONCE_CAP_S: Partial<Record<CompanionAnim, number>> = {
  wave: 3.5, lean_in: 4, surprised: 3, happy_laugh: 4, thoughtful: 6, dance: 6, pose: 4, read: 10, talk: 4,
  pout: 4, scold: 4, forgive: 4
}

type JointName =
  | "Hips" | "Spine" | "Head"
  | "LeftUpperArm" | "LeftForearm" | "RightUpperArm" | "RightForearm"
  | "LeftLeg" | "RightLeg"
const JOINT_NAMES: JointName[] = [
  "Hips", "Spine", "Head", "LeftUpperArm", "LeftForearm", "RightUpperArm", "RightForearm", "LeftLeg", "RightLeg"
]
type Euler = {x: number; y: number; z: number}
interface ProceduralFrame {
  joints: Partial<Record<JointName, Euler>>
  offset: vec3
  yawDeg: number
}

@component
export class DeskCompanionAnimator extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionAnimator – idle / walk / talk / wave / lean_in / read / dance / pose</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The swappable visual model root (CompanionModel)")
  modelRoot: SceneObject

  @input
  @allowUndefined
  @hint("Video character: the camera-facing card whose material shows the clips (additive, black = see-through)")
  videoCard: RenderMeshVisual
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Video clips (Assets/Companion/Clips/*.mp4)</span>')
  @ui.group_start("Video clips")
  @input @allowUndefined @hint("idle.mp4 — loops") idleVideo: Texture
  @input @allowUndefined @hint("walk.mp4 — loops while she walks") walkVideo: Texture
  @input @allowUndefined @hint("talk.mp4 — loops while she speaks") talkVideo: Texture
  @input @allowUndefined @hint("wave.mp4 — once, when you call her") waveVideo: Texture
  @input @allowUndefined @hint("lean_in.mp4 — once, when she teases you") leanInVideo: Texture
  @input @allowUndefined @hint("read.mp4 — once, when she opens the book") readVideo: Texture
  @input @allowUndefined @hint("dance.mp4 — once, for the dance button") danceVideo: Texture
  @input @allowUndefined @hint("pose clip — once, for the pose button (empty = uses the dance clip)") poseVideo: Texture
  @input @allowUndefined @hint("happy_laugh.mp4 — once, after she sums up the book") happyLaughVideo: Texture
  @input @allowUndefined @hint("surprised.mp4 — once, when you call her right after she teased you") surprisedVideo: Texture
  @input @allowUndefined @hint("thoughtful.mp4 — once, while she explains a word") thoughtfulVideo: Texture
  @input @allowUndefined @hint("pout.mp4 (optional) — once, when poked too often (empty = scold, then surprised)") poutVideo: Texture
  @input @allowUndefined @hint("scold.mp4 (optional) — used when there is no pout clip") scoldVideo: Texture
  @input @allowUndefined @hint("forgive.mp4 (optional) — once, when she forgives you (empty = idle)") forgiveVideo: Texture
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">AnimationPlayer clip names (3D model only)</span>')
  @ui.group_start("Clip names")
  @input @hint("Substring of the idle clip") idleClip: string = "idle"
  @input @hint("Substring of the walk clip") walkClip: string = "walk"
  @input @hint("Substring of the talk clip") talkClip: string = "talk"
  @input @hint("Substring of the wave clip") waveClip: string = "wave"
  @input @hint("Substring of the lean-in / tease clip") leanInClip: string = "lean"
  @input @hint("Substring of the read clip") readClip: string = "read"
  @input @hint("Substring of the dance clip") danceClip: string = "dance"
  @input @hint("Substring of the pose clip") poseClip: string = "pose"
  @input @hint("Substring of the happy / laugh clip") happyLaughClip: string = "laugh"
  @input @hint("Substring of the surprised clip") surprisedClip: string = "surpris"
  @input @hint("Substring of the thoughtful clip") thoughtfulClip: string = "thought"
  @input @hint("Substring of the pout clip") poutClip: string = "pout"
  @input @hint("Substring of the scold clip") scoldClip: string = "scold"
  @input @hint("Substring of the forgive clip") forgiveClip: string = "forgive"
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0.5, 3, 0.1))
  @hint("Steps per second while walking (footstep sounds use this too)")
  stepsPerSecond: number = 1.8

  @input
  @widget(new SliderWidget(1, 8, 0.5))
  @hint("Length of a play-once hook when there is no clip to time it (s)")
  fallbackOnceSeconds: number = 2.5
  @ui.group_end

  private mode: "video" | "clip" | "joints" | "tween" = "tween"
  private base: CompanionAnim = "idle"
  private baseDone = false
  private oneShot: CompanionAnim | null = null
  private showing: CompanionAnim | null = null
  private showStart = 0
  private onceEndsAt = -1
  private playToken = 0
  private ready = false

  // video
  private cardMat: Material | null = null
  private activeVideo: VideoTextureProvider | null = null
  private videoDone: (() => void) | null = null
  private videoStart = new Map<VideoTextureProvider, () => void>()
  private videoSubscribed: VideoTextureProvider[] = []
  // clip
  private player: AnimationPlayer | null = null
  private clipFor: Partial<Record<CompanionAnim, string>> = {}
  // joints / tween
  private joints: Partial<Record<JointName, Transform>> = {}
  private jointBase: Partial<Record<JointName, quat>> = {}
  private jointNow: Partial<Record<JointName, Euler>> = {}
  private modelBasePos: vec3 = vec3.zero()
  private modelBaseRot: quat = quat.quatIdentity()
  private offsetNow: vec3 = vec3.zero()
  private yawNow = 0

  /** "video" | "clip" | "joints" | "tween" — which strategy is in use. */
  public get strategy(): string { return this.mode }
  /** The hook currently on screen. */
  public get currentAnim(): CompanionAnim { return this.showing || "idle" }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.setup())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /**
   * Base animation requested by the controller (call every frame; repeats are no-ops).
   * Loop hooks loop; once hooks (read / dance / pose / wave / lean_in) play once then show idle.
   * "walk" interrupts a running one-shot; anything else waits for it to finish.
   */
  public play(hook: CompanionAnim): void {
    if (hook === this.base) return
    this.base = hook
    this.baseDone = false
    if (!this.ready) return
    if (this.oneShot && hook !== "walk") return
    this.oneShot = null
    this.show(this.base, !this.isLoop(this.base))
  }

  /**
   * Play a one-shot (e.g. wave, lean_in) over the base animation, then return to the base.
   * A later play("walk") interrupts it; other base changes wait until it finishes.
   */
  public playOnce(hook: CompanionAnim): void {
    if (!this.ready) return
    if (this.base === "walk") this.base = "idle" // she has stopped (e.g. just arrived)
    this.oneShot = hook
    this.show(hook, true)
  }

  /** Length (s) of a hook's clip if known, else the fallback. */
  public durationOf(hook: CompanionAnim): number {
    if (this.mode === "video") {
      const tex = this.videoFor(hook)
      const c = tex ? (tex.control as VideoTextureProvider) : null
      if (c && c.duration > 0) return c.duration
    }
    return this.fallbackOnceSeconds
  }

  private isLoop(h: CompanionAnim): boolean {
    return LOOP_HOOKS.indexOf(h) >= 0
  }

  private setup(): void {
    if (!this.modelRoot || isNull(this.modelRoot)) this.modelRoot = this.findByName(this.getSceneObject(), "CompanionModel")
    if (this.videoCard && this.idleVideo) {
      this.mode = "video"
      const m = this.videoCard.mainMaterial
      if (m) {
        this.cardMat = m.clone()
        this.videoCard.mainMaterial = this.cardMat
      }
    } else if (this.modelRoot) {
      this.player = this.findAnimationPlayer(this.modelRoot)
      if (this.player) this.mapClips()
      for (const n of JOINT_NAMES) {
        const so = this.findByName(this.modelRoot, n)
        if (so) {
          this.joints[n] = so.getTransform()
          this.jointBase[n] = so.getTransform().getLocalRotation()
          this.jointNow[n] = {x: 0, y: 0, z: 0}
        }
      }
      const mt = this.modelRoot.getTransform()
      this.modelBasePos = mt.getLocalPosition()
      this.modelBaseRot = mt.getLocalRotation()
      if (this.player && Object.keys(this.clipFor).length > 0) this.mode = "clip"
      else if (Object.keys(this.joints).length >= 4) this.mode = "joints"
      else this.mode = "tween"
    }
    print("DeskCompanionAnimator: strategy=" + this.mode + (this.mode === "video" && this.idleVideo ? " idleClip=" + this.idleVideo.getWidth() + "x" + this.idleVideo.getHeight() : ""))
    this.ready = true
    this.show(this.base, !this.isLoop(this.base))
  }

  private mapClips(): void {
    const names: string[] = []
    for (const c of this.player.clips) names.push(c.name)
    const wanted: Record<CompanionAnim, string> = {
      idle: this.idleClip, walk: this.walkClip, talk: this.talkClip, wave: this.waveClip,
      lean_in: this.leanInClip, read: this.readClip, dance: this.danceClip, pose: this.poseClip,
      happy_laugh: this.happyLaughClip, surprised: this.surprisedClip, thoughtful: this.thoughtfulClip,
      pout: this.poutClip, scold: this.scoldClip, forgive: this.forgiveClip
    }
    for (const h of ALL_HOOKS) {
      const key = (wanted[h] || h).toLowerCase()
      for (const n of names) {
        if (n.toLowerCase().indexOf(key) >= 0) {
          this.clipFor[h] = n
          break
        }
      }
    }
    print("DeskCompanionAnimator: clips " + JSON.stringify(names) + " -> " + JSON.stringify(this.clipFor))
  }

  /** Put a hook on screen. `once` = return to the base / idle when it ends. */
  private show(hook: CompanionAnim, once: boolean): void {
    const token = ++this.playToken
    this.showing = hook
    this.showStart = getTime()
    this.onceEndsAt = -1
    const finished = () => {
      if (token !== this.playToken) return
      this.onOnceFinished(hook)
    }

    if (this.mode === "video") {
      const tex = this.videoFor(hook)
      if (!tex || !this.cardMat) return
      const ctrl = tex.control as VideoTextureProvider
      if (this.activeVideo && this.activeVideo !== ctrl) this.stopVideo(this.activeVideo)
      this.activeVideo = ctrl
      this.cardMat.mainPass.baseTex = tex
      this.subscribeVideo(ctrl)
      this.videoDone = once ? finished : null
      const start = () => {
        if (token !== this.playToken) return
        ctrl.play(once ? 1 : -1)
      }
      if (ctrl.isPlaybackReady) start()
      else this.videoStart.set(ctrl, start)
      // end a one-shot after its cap (clips are ~10 s), or when the clip finishes, whichever is first
      if (once) {
        const cap = ONCE_CAP_S[hook] || 5
        this.onceEndsAt = getTime() + (ctrl.duration > 0 ? Math.min(cap, ctrl.duration + 0.5) : cap)
      }
      return
    }

    if (this.mode === "clip") {
      const clip = this.clipFor[hook] || this.clipFor[this.degrade(hook)]
      if (this.player) {
        this.player.stopAll()
        if (clip) {
          const c = this.player.getClip(clip)
          if (c) c.playbackMode = once ? PlaybackMode.Single : PlaybackMode.Loop
          this.player.playClip(clip)
          if (once && c) this.onceEndsAt = getTime() + Math.max(0.5, c.duration > 0 ? c.duration : this.fallbackOnceSeconds)
        }
      }
      if (once && this.onceEndsAt < 0) this.onceEndsAt = getTime() + this.fallbackOnceSeconds
      return
    }

    // joints / tween: timed
    if (once) this.onceEndsAt = getTime() + this.fallbackOnceSeconds
  }

  /** stop() throws "Calling stop from invalid state" unless the video is playing or paused. */
  private stopVideo(c: VideoTextureProvider): void {
    try {
      const st = c.status
      if (st === VideoStatus.Playing || st === VideoStatus.Paused) c.stop()
    } catch (e) {
      print("DeskCompanionAnimator: video stop failed: " + e)
    }
  }

  /** Subscribe once per video (events, not the deprecated setOnReady / setOnFinish). */
  private subscribeVideo(ctrl: VideoTextureProvider): void {
    if (this.videoSubscribed.indexOf(ctrl) >= 0) return
    this.videoSubscribed.push(ctrl)
    ctrl.onPlaybackReady.add(() => {
      const start = this.videoStart.get(ctrl)
      if (start) {
        this.videoStart.delete(ctrl)
        start()
      }
    })
    ctrl.onPlaybackDone.add(() => {
      if (ctrl !== this.activeVideo) return
      const done = this.videoDone
      this.videoDone = null
      if (done) done()
    })
  }

  private onOnceFinished(hook: CompanionAnim): void {
    this.onceEndsAt = -1
    if (this.oneShot === hook) {
      this.oneShot = null
      if (this.isLoop(this.base) || !this.baseDone) {
        // resume the base (a once-type base that already played shows idle)
        if (this.isLoop(this.base)) this.show(this.base, false)
        else if (this.base === hook) {
          this.baseDone = true
          this.show("idle", false)
        } else this.show(this.base, true)
      } else this.show("idle", false)
      return
    }
    if (hook === this.base) this.baseDone = true
    this.show("idle", false)
  }

  private degrade(h: CompanionAnim): CompanionAnim {
    if (h === "pose") return "dance"
    if (h === "lean_in" || h === "thoughtful") return "talk"
    if (h === "happy_laugh") return "wave"
    if (h === "pout") return "scold"
    if (h === "scold") return "surprised"
    return "idle"
  }

  private videoFor(h: CompanionAnim): Texture | null {
    const slot: Record<CompanionAnim, Texture | undefined> = {
      idle: this.idleVideo, walk: this.walkVideo, talk: this.talkVideo, wave: this.waveVideo,
      lean_in: this.leanInVideo, read: this.readVideo, dance: this.danceVideo, pose: this.poseVideo,
      happy_laugh: this.happyLaughVideo, surprised: this.surprisedVideo, thoughtful: this.thoughtfulVideo,
      pout: this.poutVideo, scold: this.scoldVideo, forgive: this.forgiveVideo
    }
    let cur: CompanionAnim = h
    for (let i = 0; i < 4; i++) {
      if (slot[cur]) return slot[cur]
      cur = this.degrade(cur)
    }
    return this.idleVideo || null
  }

  private tick(): void {
    if (!this.ready) return
    if (this.onceEndsAt > 0 && getTime() >= this.onceEndsAt && this.showing) {
      const h = this.showing
      this.playToken++ // invalidate the pending finish callback
      this.onOnceFinished(h)
    }
    if (this.mode === "video" || this.mode === "clip" || !this.modelRoot) return

    const dt = getDeltaTime()
    const t = getTime() - this.showStart
    const hook = this.showing || "idle"
    const frame = this.mode === "joints" ? this.jointFrame(hook, t) : this.tweenFrame(hook, t)
    const k = clamp(dt * 8, 0, 1)
    if (this.mode === "joints") {
      for (const n of JOINT_NAMES) {
        const tr = this.joints[n]
        if (!tr) continue
        const target = frame.joints[n] || {x: 0, y: 0, z: 0}
        const now = this.jointNow[n]
        now.x = lerp(now.x, target.x, k)
        now.y = lerp(now.y, target.y, k)
        now.z = lerp(now.z, target.z, k)
        tr.setLocalRotation(this.jointBase[n].multiply(quat.fromEulerAngles(degToRad(now.x), degToRad(now.y), degToRad(now.z))))
      }
    }
    this.offsetNow = vec3.lerp(this.offsetNow, frame.offset, k)
    this.yawNow = lerp(this.yawNow, frame.yawDeg, clamp(dt * 5, 0, 1))
    const mt = this.modelRoot.getTransform()
    mt.setLocalPosition(this.modelBasePos.add(this.offsetNow))
    mt.setLocalRotation(quat.angleAxis(degToRad(this.yawNow), vec3.up()).multiply(this.modelBaseRot))
  }

  // ── Procedural poses for a jointed 3D model (degrees; +X swings a limb forward) ──
  private jointFrame(hook: CompanionAnim, t: number): ProceduralFrame {
    const s = Math.sin
    const z = vec3.zero()
    switch (hook) {
      case "walk": {
        const w = s(t * this.stepsPerSecond * Math.PI)
        return {joints: {
          LeftLeg: {x: 24 * w, y: 0, z: 0}, RightLeg: {x: -24 * w, y: 0, z: 0},
          LeftUpperArm: {x: -16 * w, y: 0, z: -5}, RightUpperArm: {x: 16 * w, y: 0, z: 5},
          LeftForearm: {x: 12, y: 0, z: 0}, RightForearm: {x: 12, y: 0, z: 0},
          Hips: {x: 0, y: 4 * w, z: 0}, Spine: {x: 3, y: -5 * w, z: 0}
        }, offset: new vec3(0, 1.6 * Math.abs(w), 0), yawDeg: 0}
      }
      case "talk":
        return {joints: {
          Head: {x: 4 * s(t * 5.2) - 2, y: 6 * s(t * 0.9), z: 4 * s(t * 1.3)},
          RightUpperArm: {x: 22 + 6 * s(t * 2.4), y: 0, z: 10}, RightForearm: {x: 60 + 14 * s(t * 3.1), y: 0, z: 0}
        }, offset: z, yawDeg: 0}
      case "wave":
        return {joints: {
          RightUpperArm: {x: 10, y: 0, z: 150}, RightForearm: {x: 30 + 25 * s(t * 18), y: 0, z: 0},
          Head: {x: 0, y: 0, z: 8}
        }, offset: z, yawDeg: 0}
      case "lean_in":
        return {joints: {
          Spine: {x: 14, y: 0, z: 0}, Head: {x: 6, y: 0, z: 12},
          LeftUpperArm: {x: -25, y: 0, z: -10}, RightUpperArm: {x: -25, y: 0, z: 10}
        }, offset: z, yawDeg: 0}
      case "read":
        return {joints: {
          LeftUpperArm: {x: 30, y: 0, z: -8}, RightUpperArm: {x: 30, y: 0, z: 8},
          LeftForearm: {x: 62, y: 0, z: 0}, RightForearm: {x: 62, y: 0, z: 0}, Head: {x: -20, y: 0, z: 0}
        }, offset: z, yawDeg: 0}
      case "dance": {
        const b = s(t * Math.PI * 2.2)
        return {joints: {
          Hips: {x: 0, y: 0, z: 7 * b}, Spine: {x: 0, y: 0, z: -9 * b}, Head: {x: 0, y: 0, z: 10 * b},
          LeftUpperArm: {x: 10, y: 0, z: -(120 + 35 * s(t * 13.8))}, RightUpperArm: {x: 10, y: 0, z: 120 + 35 * s(t * 13.8 + Math.PI)}
        }, offset: new vec3(6 * b, 3 * Math.abs(b), 0), yawDeg: 0}
      }
      case "pose":
        return {joints: {
          RightUpperArm: {x: 25, y: 0, z: 150}, RightForearm: {x: 70, y: 0, z: 0},
          LeftUpperArm: {x: -10, y: 0, z: -38}, LeftForearm: {x: 95, y: -40, z: 0}, Head: {x: 2, y: -8, z: 12}
        }, offset: z, yawDeg: 0}
      case "idle":
      default: {
        const look = s(t * 0.35) * 18
        return {joints: {
          Head: {x: 2 * s(t * 0.5), y: look, z: 0}, Spine: {x: 1.2 * s(t * 1.6), y: 0, z: 0},
          LeftUpperArm: {x: 0, y: 0, z: -6}, RightUpperArm: {x: 0, y: 0, z: 6}
        }, offset: new vec3(0, 0.25 * s(t * 1.6), 0), yawDeg: 0}
      }
    }
  }

  // ── Whole-model tweens for a model with no clips and no joints ──
  private tweenFrame(hook: CompanionAnim, t: number): ProceduralFrame {
    const s = Math.sin
    switch (hook) {
      case "walk": return {joints: {}, offset: new vec3(0, 2 * Math.abs(s(t * this.stepsPerSecond * Math.PI)), 0), yawDeg: 0}
      case "talk": return {joints: {}, offset: new vec3(0, 0.6 * Math.abs(s(t * 5)), 0), yawDeg: 4 * s(t * 1.2)}
      case "wave": return {joints: {}, offset: new vec3(0, 1.5 * Math.abs(s(t * 6)), 0), yawDeg: 10 * s(t * 6)}
      case "lean_in": return {joints: {}, offset: new vec3(0, -2, 6), yawDeg: 0}
      case "read": return {joints: {}, offset: new vec3(0, -1.5, 0), yawDeg: 0}
      case "dance": return {joints: {}, offset: new vec3(6 * s(t * 6.9), 4 * Math.abs(s(t * 6.9)), 0), yawDeg: (t * 120) % 360}
      case "pose": return {joints: {}, offset: new vec3(0, 3, 0), yawDeg: 20}
      default: return {joints: {}, offset: new vec3(0, 0.6 * s(t * 1.4), 0), yawDeg: 0}
    }
  }

  private findByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) return root
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const r = this.findByName(root.getChild(i), name)
      if (r) return r
    }
    return null
  }

  private findAnimationPlayer(root: SceneObject): AnimationPlayer | null {
    const p = root.getComponent("Component.AnimationPlayer") as AnimationPlayer
    if (p) return p
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const r = this.findAnimationPlayer(root.getChild(i))
      if (r) return r
    }
    return null
  }
}
