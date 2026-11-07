/**
 * DeskCompanionVoice — makes the companion "say" a line: plays the recorded voice clip for that
 * line id (if one is dropped in) from her spatial AudioComponent, and shows the Japanese +
 * English subtitle in her speech bubble. With no clip, subtitles only.
 *
 * Owns: voice playback and subtitle timing.
 * Inputs: voiceAudio (spatial AudioComponent at her head), speechBubble UI, one optional
 *         AudioTrackAsset slot per line id (see DeskCompanionContent for the text of each id).
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
  @hint("Voice volume")
  voiceVolume: number = 1.0

  @input
  @widget(new SliderWidget(0.5, 8, 0.5))
  @hint("Seconds the subtitle stays after she finishes speaking, then it fades")
  subtitleHoldSeconds: number = 3

  @input
  @widget(new SliderWidget(0.05, 0.3, 0.01))
  @hint("Assumed speaking time per Japanese character when a line has no recorded clip")
  secondsPerChar: number = 0.13
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Voice clips (optional) — drop a recording on the matching line</span>')
  @ui.group_start("Voice clips")
  @input @allowUndefined @hint("どうしたの？ / What's up?") vo_call_whats_up: AudioTrackAsset
  @input @allowUndefined @hint("何してるの？ 何か手伝おうか？") vo_tease_1: AudioTrackAsset
  @input @allowUndefined @hint("何か食べたいものある？") vo_tease_2: AudioTrackAsset
  @input @allowUndefined @hint("ずっと頑張ってるね。少し休憩する？") vo_tease_3: AudioTrackAsset
  @input @allowUndefined @hint("じゃあ、また呼んでね。") vo_leave: AudioTrackAsset
  @input @allowUndefined @hint("serendipity の説明") vo_word_serendipity: AudioTrackAsset
  @input @allowUndefined @hint("ephemeral の説明") vo_word_ephemeral: AudioTrackAsset
  @input @allowUndefined @hint("날씨 の説明") vo_word_nalssi: AudioTrackAsset
  @input @allowUndefined @hint("감사합니다 の説明") vo_word_gamsahamnida: AudioTrackAsset
  @input @allowUndefined @hint("薔薇 の説明") vo_word_bara: AudioTrackAsset
  @input @allowUndefined @hint("憂鬱 の説明") vo_word_yuuutsu: AudioTrackAsset
  @input @allowUndefined @hint("檸檬 の説明") vo_word_remon: AudioTrackAsset
  @input @allowUndefined @hint("齧る の説明") vo_word_kajiru: AudioTrackAsset
  @input @allowUndefined @hint("あ、本？ ちょっと読んでみるね。") vo_book_received: AudioTrackAsset
  @input @allowUndefined @hint("『不思議の国のアリス』の要約") vo_book_summary: AudioTrackAsset
  @input @allowUndefined @hint("はい、返すね。素敵な本だった。") vo_book_return: AudioTrackAsset
  @input @allowUndefined @hint("ちょっとだけ踊るね！") vo_dance: AudioTrackAsset
  @input @allowUndefined @hint("こんな感じ？") vo_pose: AudioTrackAsset
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
    this.voiceAudio.volume = this.voiceVolume
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

  /** Returns the clip dropped into the slot for this line id, or null. */
  public clipFor(lineId: string): AudioTrackAsset | null {
    const v = (this as unknown as Record<string, AudioTrackAsset | undefined>)["vo_" + lineId]
    return v ? v : null
  }

  /**
   * Speak a line. Returns how long she will be speaking (seconds).
   * Plays the recorded clip if present; otherwise shows subtitles only for an estimated time.
   */
  public say(lineId: string): number {
    const line = findLine(lineId)
    if (!line) {
      print("DeskCompanionVoice: unknown line id " + lineId)
      return 0
    }
    this.lastLine = line
    let duration = Math.max(1.6, line.ja.length * this.secondsPerChar)
    const clip = this.clipFor(lineId)
    if (clip && this.voiceAudio) {
      try {
        if (this.voiceAudio.isPlaying()) this.voiceAudio.stop(false) // stop() throws if nothing has played yet
        this.voiceAudio.audioTrack = clip
        this.voiceAudio.volume = this.voiceVolume
        this.voiceAudio.play(1)
        if (this.voiceAudio.duration > 0) duration = this.voiceAudio.duration
      } catch (e) {
        print("DeskCompanionVoice: could not play clip for " + lineId + ": " + e)
      }
    }
    if (this.speechBubble) this.speechBubble.showLine(line.ja, line.en)
    this.speakingUntil = getTime() + duration
    this.hideAt = this.speakingUntil + this.subtitleHoldSeconds
    print("DeskCompanion says [" + line.id + "] " + line.ja + " / " + line.en + (clip ? " (voice clip)" : " (subtitle only)"))
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
