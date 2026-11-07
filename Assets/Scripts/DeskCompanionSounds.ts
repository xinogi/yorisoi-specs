/**
 * DeskCompanionSounds — the companion's small sounds (footsteps, attention chime, page flip,
 * sparkle), all played from spatial AudioComponents on her so you can hear where she is
 * even when she is outside the narrow display.
 *
 * Owns: SFX playback and spatial setup for those two AudioComponents.
 * Must not: decide when sounds play (the controller does).
 */

@component
export class DeskCompanionSounds extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionSounds – spatial footsteps and small sounds</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Spatial AudioComponent at her feet, for footsteps")
  stepAudio: AudioComponent

  @input
  @hint("Spatial AudioComponent on her body, for chime / page flip / sparkle")
  fxAudio: AudioComponent

  @input
  @hint("Footstep variation 1")
  footstep1: AudioTrackAsset

  @input
  @hint("Footstep variation 2")
  footstep2: AudioTrackAsset

  @input
  @hint("Soft chime when she notices you / decides to come over")
  attentionChime: AudioTrackAsset

  @input
  @hint("Page flip when she opens the book")
  pageFlip: AudioTrackAsset

  @input
  @hint("Sparkle for the dance / pose")
  sparkle: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Footstep volume")
  footstepVolume: number = 0.55

  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Volume of chime / page flip / sparkle")
  fxVolume: number = 0.7
  @ui.group_end

  private stepToggle = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.makeSpatial(this.stepAudio)
      this.makeSpatial(this.fxAudio)
    })
  }

  private makeSpatial(a: AudioComponent): void {
    if (!a) return
    a.playbackMode = Audio.PlaybackMode.LowLatency
    const sa = a.spatialAudio
    if (!sa) return
    sa.enabled = true
    if (sa.positionEffect) sa.positionEffect.enabled = true
    if (sa.distanceEffect) {
      sa.distanceEffect.enabled = true
      sa.distanceEffect.minDistance = 60
      sa.distanceEffect.maxDistance = 900
    }
    if (sa.directivityEffect) sa.directivityEffect.enabled = false
  }

  private playOn(a: AudioComponent, track: AudioTrackAsset, volume: number): void {
    if (!a || !track) return
    try {
      if (a.isPlaying()) a.stop(false) // stop() throws if nothing has played yet
      a.audioTrack = track
      a.volume = volume
      a.play(1)
    } catch (e) {
      print("DeskCompanionSounds: could not play " + track.name + ": " + e)
    }
  }

  public playFootstep(): void {
    this.stepToggle = !this.stepToggle
    this.playOn(this.stepAudio, this.stepToggle ? this.footstep1 : this.footstep2, this.footstepVolume)
  }

  public playChime(): void {
    this.playOn(this.fxAudio, this.attentionChime, this.fxVolume)
  }

  public playPageFlip(): void {
    this.playOn(this.fxAudio, this.pageFlip, this.fxVolume)
  }

  public playSparkle(): void {
    this.playOn(this.fxAudio, this.sparkle, this.fxVolume)
  }
}
