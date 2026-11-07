/**
 * DeskCompanionBook — the grabbable stand-in book on the desk ("I hand her a real book").
 *
 * Owns: the book's grab interaction (SIK Interactable + InteractableManipulation, created at
 * runtime on this SceneObject so LEAF can find the interactable named "Book"), hover highlight,
 * hand-off detection on release, flying into her hands, opening/closing the cover, and
 * returning to its spot on the desk.
 *
 * Hand-off rule: on release, the book counts as offered to her if it is within
 * `handoffRadiusCm` of her chest, OR it was lifted at least `minMoveCm` off its desk spot and,
 * seen from the user's eyes, lies within `handoffConeDeg` of her (i.e. you held it out toward
 * her). Otherwise it slides back to its spot.
 *
 * Must not: decide what she does with it (the controller does) or show text.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class DeskCompanionBook extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionBook – grab it and hand it to her</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Pivot along the spine; rotating it opens the front cover")
  frontCoverHinge: SceneObject

  @input
  @hint("Front cover mesh, brightened while the book is aimed at")
  coverVisual: RenderMeshVisual

  @input
  @hint("Companion root (at her feet) used for the hand-off test")
  companionRoot: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(20, 200, 5))
  @hint("Release within this distance (cm) of her chest = handed to her")
  handoffRadiusCm: number = 80

  @input
  @widget(new SliderWidget(5, 45, 1))
  @hint("Release within this angle of her, as seen from your eyes, also counts as handing it to her")
  handoffConeDeg: number = 20

  @input
  @widget(new SliderWidget(0, 40, 1))
  @hint("For the angle rule the book must have moved at least this far (cm) from its desk spot")
  minMoveCm: number = 10

  @input("vec3", "{1.0, 0.92, 0.55}")
  @widget(new ColorWidget())
  @hint("Cover tint while the book is aimed at (light colors show on the additive display)")
  hoverTint: vec3
  @ui.group_end

  private interactable: Interactable
  private manipulation: InteractableManipulation
  private collider: ColliderComponent
  private homeParent: SceneObject | null = null
  private homeLocalPos: vec3 = vec3.zero()
  private homeLocalRot: quat = quat.quatIdentity()
  private coverMat: Material | null = null
  private coverBaseColor: vec4 = new vec4(1, 1, 1, 1)
  private cancelMove: CancelFunction | null = null
  private cancelCover: CancelFunction | null = null
  private _held = false
  private _withCompanion = false
  private _open = false

  private _onGrabbed = new Event<void>()
  private _onOffered = new Event<void>()
  private _onReturnedHome = new Event<void>()

  /** User picked the book up. */
  get onGrabbed(): PublicApi<void> { return this._onGrabbed.publicApi() }
  /** User released the book in the hand-off zone (toward / near her). */
  get onOffered(): PublicApi<void> { return this._onOffered.publicApi() }
  /** The book settled back on its desk spot. */
  get onReturnedHome(): PublicApi<void> { return this._onReturnedHome.publicApi() }

  public get isHeldByUser(): boolean { return this._held }
  public get isWithCompanion(): boolean { return this._withCompanion }
  public get isOpen(): boolean { return this._open }

  onAwake(): void {
    const so = this.getSceneObject()
    const t = this.getTransform()
    this.homeParent = so.getParent()
    this.homeLocalPos = t.getLocalPosition()
    this.homeLocalRot = t.getLocalRotation()

    // Collider sized to the book (local: x = width, y = thickness, z = height)
    this.collider = so.getComponent("Physics.ColliderComponent") as ColliderComponent
    if (!this.collider) {
      this.collider = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      const box = Shape.createBoxShape()
      box.size = new vec3(17, 5, 23)
      this.collider.shape = box
    }
    this.interactable = so.getComponent(Interactable.getTypeName()) as Interactable
    if (!this.interactable) this.interactable = so.createComponent(Interactable.getTypeName()) as Interactable
    this.manipulation = so.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    if (!this.manipulation) this.manipulation = so.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation

    if (this.coverVisual) {
      const m = this.coverVisual.mainMaterial
      if (m) {
        this.coverMat = m.clone()
        this.coverVisual.mainMaterial = this.coverMat
        this.coverBaseColor = this.coverMat.mainPass.baseColor
      }
    }

    this.createEvent("OnStartEvent").bind(() => {
      this.manipulation.setCanRotate(false)
      this.manipulation.setCanScale(false)
      this.interactable.onHoverEnter.add(() => this.setHighlight(true))
      this.interactable.onHoverExit.add(() => this.setHighlight(false))
      this.manipulation.onManipulationStart.add(() => {
        if (this._withCompanion) return
        this._held = true
        if (this.cancelMove) this.cancelMove()
        this._onGrabbed.invoke()
      })
      this.manipulation.onManipulationEnd.add(() => {
        if (!this._held) return
        this._held = false
        this.setHighlight(false)
        if (this.isInHandoffZone()) {
          print("DeskCompanionBook: offered to the companion")
          this._onOffered.invoke()
        } else {
          this.returnHome()
        }
      })
    })
  }

  private setHighlight(on: boolean): void {
    if (!this.coverMat) return
    const b = this.coverBaseColor
    this.coverMat.mainPass.baseColor = on ? new vec4(this.hoverTint.x, this.hoverTint.y, this.hoverTint.z, b.w) : b
  }

  /** True if the book's current position counts as handing it to her. */
  public isInHandoffZone(): boolean {
    if (!this.companionRoot) return false
    const b = this.getTransform().getWorldPosition()
    const chest = this.companionRoot.getTransform().getWorldPosition().add(new vec3(0, 118, 0))
    if (b.distance(chest) <= this.handoffRadiusCm) return true
    const homeWorld = this.homeWorldPosition()
    if (b.distance(homeWorld) < this.minMoveCm) return false
    const eye = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const toBook = b.sub(eye).normalize()
    const toHer = chest.sub(eye).normalize()
    const angle = (Math.acos(Math.max(-1, Math.min(1, toBook.dot(toHer)))) * 180) / Math.PI
    return angle <= this.handoffConeDeg
  }

  private homeWorldPosition(): vec3 {
    if (this.homeParent) return this.homeParent.getTransform().getWorldTransform().multiplyPoint(this.homeLocalPos)
    return this.homeLocalPos
  }

  /** Enable / disable grabbing (off while she holds it). */
  public setGrabbable(on: boolean): void {
    if (this.interactable) this.interactable.enabled = on
    if (this.manipulation) this.manipulation.enabled = on
    if (this.collider) this.collider.enabled = on
  }

  /** Fly into `anchor` (her hands) over `seconds`, then stay parented there. */
  public flyTo(anchor: SceneObject, seconds: number, done?: () => void): void {
    this._withCompanion = true
    this._held = false
    this.setGrabbable(false)
    this.setHighlight(false)
    const so = this.getSceneObject()
    so.setParentPreserveWorldTransform(anchor)
    this.tweenLocal(vec3.zero(), quat.quatIdentity(), seconds, done)
  }

  /** Slide back to the original spot on the desk and become grabbable again. */
  public returnHome(done?: () => void): void {
    const so = this.getSceneObject()
    if (this.homeParent && !so.getParent().isSame(this.homeParent)) {
      so.setParentPreserveWorldTransform(this.homeParent)
    }
    this.tweenLocal(this.homeLocalPos, this.homeLocalRot, 0.7, () => {
      this._withCompanion = false
      this.setGrabbable(true)
      this._onReturnedHome.invoke()
      if (done) done()
    })
  }

  /** Open or close the front cover. */
  public setOpen(open: boolean, seconds: number = 0.6): void {
    if (!this.frontCoverHinge) return
    this._open = open
    if (this.cancelCover) this.cancelCover()
    const tr = this.frontCoverHinge.getTransform()
    const from = tr.getLocalRotation()
    const to = open ? quat.angleAxis((170 * Math.PI) / 180, new vec3(0, 0, 1)) : quat.quatIdentity()
    this.cancelCover = animate({
      duration: seconds,
      easing: "ease-in-out-quad",
      update: (t: number) => tr.setLocalRotation(quat.slerp(from, to, t))
    })
  }

  private tweenLocal(pos: vec3, rot: quat, seconds: number, done?: () => void): void {
    if (this.cancelMove) this.cancelMove()
    const tr = this.getTransform()
    const p0 = tr.getLocalPosition()
    const r0 = tr.getLocalRotation()
    this.cancelMove = animate({
      duration: seconds,
      easing: "ease-in-out-quad",
      update: (t: number) => {
        tr.setLocalPosition(vec3.lerp(p0, pos, t))
        tr.setLocalRotation(quat.slerp(r0, rot, t))
      },
      ended: () => {
        if (done) done()
      }
    })
  }
}
