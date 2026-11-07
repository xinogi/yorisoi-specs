/**
 * DeskCompanionVoice — makes the companion "say" a line: plays the recorded (English) voice clip
 * for that line id from her spatial AudioComponent, and shows the subtitle in her speech bubble
 * (English big, Japanese small). With no clip for a line, subtitles only.
 *
 * Owns: voice playback and subtitle timing.
 * Inputs: voiceAudio (spatial AudioComponent at her head), speechBubble UI, and `voiceClips`: every
 *         voice MP3. A clip is matched to a line by its asset NAME = the line id
 *         (Assets/Companion/Voice/<id>.mp3, Assets/Companion/Voice/modes/<modeId>__<key>.mp3).
 *         To add or replace a voice line: drop the MP3 (named after the line id) into the list.
 * Must not: decide when she speaks (the controller does) or hold experience state.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionSpeechBubbleUI} from "./DeskCompanionSpeechBubbleUI"
import {CompanionLine, findLine} from "./DeskCompanionContent"

@component
export class DeskCompanionVoice extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionVoice – voice clips + subtitles</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Spatial AudioComponent at her head; her voice comes from her direction")
  voiceAudio: AudioComponent

  @input
  @hint("Speech bubble beside her head that shows the subtitle")
  speechBubble: DeskCompanionSpeechBubbleUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Voice volume (0-1). The desk 'Voice' slider changes it at runtime (session only).")
  voiceVolume: number = 0.7

  @input
  @widget(new SliderWidget(0.5, 8, 0.5))
  @hint("Seconds the subtitle stays after she finishes speaking, then it fades")
  subtitleHoldSeconds: number = 3

  @input
  @widget(new SliderWidget(0.03, 0.15, 0.005))
  @hint("Assumed speaking time per English character when a line has no recorded clip")
  secondsPerChar: number = 0.065
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Voice clips — file name = line id (e.g. smart__call, word_bara)</span>')
  @ui.group_start("Voice clips")
  @input
  @allowUndefined
  @hint("All voice MP3s. Each is matched to a line by its asset name (= line id)")
  voiceClips: AudioTrackAsset[]
  @ui.group_end

  private speakingUntil = 0
  private hideAt = -1
  private lastLine: CompanionLine | null = null
  private _onLineSpoken = new Event<string>()

  /** Fires with the line id every time she starts a line (for tests / logs). */
  get onLineSpoken(): PublicApi<string> {
    return this._onLineSpoken.publicApi()
  }

  /** Id of the most recent line (empty before she has spoken). */
  public get lastLineId(): string {
    return this.lastLine ? this.lastLine.id : ""
  }

  private _muted = false

  /** True while the desk mute button has silenced her voice (subtitles still show). */
  public get muted(): boolean { return this._muted }
  /** Volume actually applied to the voice AudioComponent (0 when muted). */
  public get effectiveVolume(): number { return this._muted ? 0 : this.voiceVolume }

  /** Set her voice volume (0-1) — applies right away, also to a line already playing. */
  public setVolume(v: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, v))
    this.applyVolume()
  }

  /** Mute / unmute her voice (subtitles keep showing). */
  public setMuted(m: boolean): void {
    this._muted = m
    this.applyVolume()
  }

  private applyVolume(): void {
    if (this.voiceAudio) this.voiceAudio.volume = this.effectiveVolume
  }

  public get isSpeaking(): boolean {
    return getTime() < this.speakingUntil
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.setupAudio())
    this.createEvent("UpdateEvent").bind(() => {
      if (this.hideAt > 0 && getTime() >= this.hideAt) {
        this.hideAt = -1
        if (this.speechBubble) this.speechBubble.hide()
      }
    })
  }

  private setupAudio(): void {
    if (!this.voiceAudio) {
      print("DeskCompanionVoice: voiceAudio not wired — subtitles only")
      return
    }
    this.voiceAudio.playbackMode = Audio.PlaybackMode.LowLatency
    this.voiceAudio.volume = this.effectiveVolume
    const sa = this.voiceAudio.spatialAudio
    if (sa) {
      sa.enabled = true
      if (sa.positionEffect) sa.positionEffect.enabled = true
      if (sa.distanceEffect) {
        sa.distanceEffect.enabled = true
        sa.distanceEffect.minDistance = 60
        sa.distanceEffect.maxDistance = 900
      }
      if (sa.directivityEffect) sa.directivityEffect.enabled = false
    }
  }

  private clipIndex: Record<string, AudioTrackAsset> | null = null

  /** Returns the voice clip whose asset name equals this line id, or null. */
  public clipFor(lineId: string): AudioTrackAsset | null {
    if (!this.clipIndex) {
      this.clipIndex = {}
      const list = this.voiceClips || []
      for (const c of list) {
        if (c && !isNull(c)) this.clipIndex[c.name] = c
      }
    }
    return this.clipIndex[lineId] || null
  }

  /** Number of voice clips found (for checks). */
  public get clipCount(): number {
    this.clipFor("")
    return Object.keys(this.clipIndex).length
  }

  /**
   * Speak a line. Returns how long she will be speaking (seconds).
   * Plays the recorded clip if present; otherwise shows subtitles only for an estimated time.
   */
  public say(lineId: string, badge: string = "", subtitle: {en: string; ja: string} | null = null): number {
    const found = findLine(lineId)
    if (!found) {
      print("DeskCompanionVoice: unknown line id " + lineId)
      return 0
    }
    // optional subtitle override (e.g. the measured rehearsal time); the voice clip stays the same
    const line = subtitle ? Object.assign({}, found, {en: subtitle.en, ja: subtitle.ja}) : found
    this.lastLine = line
    let duration = Math.max(1.6, line.en.length * this.secondsPerChar)
    const clip = this.clipFor(lineId)
    if (clip && this.voiceAudio) {
      try {
        if (this.voiceAudio.isPlaying()) this.voiceAudio.stop(false) // stop() throws if nothing has played yet
        this.voiceAudio.audioTrack = clip
        this.voiceAudio.volume = this.effectiveVolume
        this.voiceAudio.play(1)
        if (this.voiceAudio.duration > 0) duration = this.voiceAudio.duration
      } catch (e) {
        print("DeskCompanionVoice: could not play clip for " + lineId + ": " + e)
      }
    }
    if (this.speechBubble) this.speechBubble.showLine(line.ja, line.en, badge)
    this.speakingUntil = getTime() + duration
    this.hideAt = this.speakingUntil + this.subtitleHoldSeconds
    print("DeskCompanion says [" + line.id + "] " + line.en + " / " + line.ja + (clip ? " (voice clip)" : " (subtitle only)"))
    this._onLineSpoken.invoke(line.id)
    return duration
  }

  /** Stop talking and hide the bubble right away. */
  public silence(): void {
    if (this.voiceAudio && this.voiceAudio.isPlaying()) this.voiceAudio.stop(true)
    this.speakingUntil = 0
    this.hideAt = -1
    if (this.speechBubble) this.speechBubble.hide()
  }
}
