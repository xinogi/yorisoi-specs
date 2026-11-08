/**
 * DeskCompanionSecretary — Briefing, Timer / reminders, and Music together.
 *
 * Owns (single source of truth for all three):
 *   - Briefing (Briefing button, and the FIRST Call of the session — she still never speaks
 *     unprompted): real weather from Open-Meteo for Tokyo (no key; fallback = sample weather
 *     labelled "offline"), today's sample tasks and a sample reminder on the card beside her,
 *     "briefing_intro" then "briefing_rehearse" with a "Rehearse" shortcut into Cue cards mode.
 *   - Timer (Timer button cycles: 1 min -> 5 min (rehearsal) -> Stretch reminder (demo 30 s) ->
 *     Talk in 1 min (demo 20 s) -> off). A big countdown floats beside her; on done she says
 *     timer_done / reminder_stretch (+ Stretch shortcut) / reminder_talk. Session-only.
 *   - Music (Music button cycles Off -> Focus -> Relax -> Off): loops the track at `musicVolume`
 *     (desk slider), ducks to 15 % while she speaks, and she sways (a dance one-shot now and then)
 *     while idle. Missing track files are tolerated (the mode still cycles, nothing plays).
 *   - Look it up (Look up button cycles Risotto -> Kyoto -> Augmented reality -> Alice's Adventures
 *     in Wonderland -> "Type a topic…" (AR keyboard; demo topic in the editor)): a REAL summary from
 *     the Wikipedia REST API (no key), first ~2 sentences + "Source: Wikipedia (CC BY-SA)" on the
 *     card; offline fallback = short built-in summaries labelled "offline". Also offered after she
 *     returns the book ("Learn more").
 * Test hooks: briefingShown, weatherSource, timerRemaining, timerKind, musicTrack, lastLookupTitle,
 *   lookupSource, timeScale.
 * Must not: build UI (DeskCompanionInfoCardUI does) or move her.
 */
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionAnimator} from "./DeskCompanionAnimator"
import {DeskCompanionInfoCardUI} from "./DeskCompanionInfoCardUI"
import {DeskCompanionModeController} from "./DeskCompanionModeController"
import {DeskCompanionStretch} from "./DeskCompanionStretch"

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.76&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&forecast_days=2"
type TimerKind = "" | "timer" | "stretch" | "talk"
interface TimerPreset { label: string; seconds: number; kind: TimerKind }
const TIMER_PRESETS: TimerPreset[] = [
  {label: "Timer · 1 min", seconds: 60, kind: "timer"},
  {label: "Timer · 5 min (rehearsal)", seconds: 300, kind: "timer"},
  {label: "Stretch reminder (demo: 30 s)", seconds: 30, kind: "stretch"},
  {label: "Talk in 1 min (demo: 20 s)", seconds: 20, kind: "talk"}
]
type MusicTrack = "off" | "focus" | "relax"

const LOOKUP_TOPICS = ["Risotto", "Kyoto", "Augmented reality", "Alice's Adventures in Wonderland"]
const LOOKUP_TYPE = "Type a topic…"
const LOOKUP_DEMO_TOPIC = "Tokyo Tower"
const LOOKUP_USER_AGENT = "YorisoiLens/0.1 (hackathon demo)"
/** Offline fallback summaries (short, written for this demo). */
const LOOKUP_OFFLINE: {[title: string]: string} = {
  "Risotto": "Risotto is a northern Italian rice dish cooked slowly in broth until creamy.",
  "Kyoto": "Kyoto is a city in Japan, the imperial capital for more than a thousand years, known for its temples and gardens.",
  "Augmented reality": "Augmented reality adds computer-generated images and information on top of the real world you see.",
  "Alice's Adventures in Wonderland": "Alice's Adventures in Wonderland is an 1865 novel by Lewis Carroll about a girl who falls down a rabbit hole into a fantasy world."
}

/** First n sentences of a text. */
function firstSentences(text: string, n: number): string {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g)
  if (!parts || parts.length === 0) return text
  return parts.slice(0, n).join("").trim()
}

/** WMO weather code -> short English words. */
function weatherWords(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 2) return "Partly cloudy"
  if (code === 3) return "Cloudy"
  if (code === 45 || code === 48) return "Fog"
  if (code >= 51 && code <= 57) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Showers"
  if (code >= 85 && code <= 86) return "Snow showers"
  if (code >= 95) return "Thunderstorm"
  return "—"
}

@component
export class DeskCompanionSecretary extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionSecretary – briefing, timers / reminders, music together</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input @hint("Companion controller") controller: DeskCompanionController
  @input @hint("Voice + subtitles") voice: DeskCompanionVoice
  @input @hint("Animator (sway while music plays)") animator: DeskCompanionAnimator
  @input @hint("Card beside her (briefing / countdown)") card: DeskCompanionInfoCardUI
  @input @hint("Modes (Rehearse shortcut enters Cue cards mode)") modes: DeskCompanionModeController
  @input @allowUndefined @hint("Stretch routine (Stretch shortcut)") stretch: DeskCompanionStretch
  @input @allowUndefined @hint("music_focus.mp3 (optional — missing = silent)") musicFocus: AudioTrackAsset
  @input @allowUndefined @hint("music_relax.mp3 (optional — missing = silent)") musicRelax: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input @widget(new SliderWidget(0, 1, 0.05)) @hint("Music volume (the desk Music slider changes it)") musicVolume: number = 0.4
  @input @widget(new SliderWidget(0, 1, 0.05)) @hint("Music volume while she speaks") musicDuckVolume: number = 0.15
  @input @widget(new SliderWidget(5, 30, 1)) @hint("Seconds the briefing card stays") briefingHoldSeconds: number = 14
  @input @widget(new SliderWidget(1, 8, 0.5)) @hint("Weather request timeout (s)") timeoutSeconds: number = 4
  @ui.group_end

  /** Test hook: timer clock speed (1 = real time). */
  public timeScale: number = 1

  private internetModule: InternetModule = require("LensStudio:InternetModule")
  private _briefingShown = false
  private briefingDone = false // the first Call of the session gets a briefing only once
  private _weatherSource: "" | "live" | "offline" = ""
  private briefingHideAt = -1
  private pendingRehearseAt = -1
  private presetIndex = -1
  private _timerKind: TimerKind = ""
  private _timerRemaining = 0
  private _musicTrack: MusicTrack = "off"
  private musicAudio: AudioComponent | null = null
  private nextSwayAt = 0
  private shortcut: "" | "rehearse" | "stretch" | "learn" = ""
  private lookupIndex = -1
  private _lastLookupTitle = ""
  private _lookupSource: "" | "live" | "offline" = ""
  private learnTopic = ""
  private lookupBusy = false

  public get briefingShown(): boolean { return this._briefingShown }
  public get weatherSource(): string { return this._weatherSource }
  public get timerRemaining(): number { return this._timerRemaining }
  public get timerKind(): string { return this._timerKind }
  public get musicTrack(): string { return this._musicTrack }
  /** Title of the last looked-up topic ("" before the first). */
  public get lastLookupTitle(): string { return this._lastLookupTitle }
  /** "live" (Wikipedia) or "offline" (built-in summary). */
  public get lookupSource(): string { return this._lookupSource }
  /** True until the first briefing of the session has played. */
  public get firstCallBriefingPending(): boolean { return !this.briefingDone }

  onAwake(): void {
    const so = global.scene.createSceneObject("MusicSource")
    so.setParent(this.getSceneObject())
    this.musicAudio = so.createComponent("Component.AudioComponent") as AudioComponent
    this.createEvent("OnStartEvent").bind(() => {
      if (this.card) this.card.onShortcut.add(() => this.onShortcut())
    })
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // ───────────────────────────── briefing ─────────────────────────────

  /** Morning briefing: weather (live or offline sample), today, reminder; then offer a rehearsal. */
  public async briefing(): Promise<void> {
    this.briefingDone = true
    if (this.controller) this.controller.noteInteraction()
    const d = this.voice ? this.voice.say("briefing_intro") : 2
    this.pendingRehearseAt = getTime() + Math.max(1.5, d) + 0.3
    const w = await this.fetchWeather()
    this._weatherSource = w.source
    const lines = [
      "Today: " + w.today,
      "Tomorrow: " + w.tomorrow,
      "Today: 3 tasks (sample)",
      "Reminder: stretch at 3pm (sample)"
    ]
    this.shortcut = "rehearse"
    if (this.card) this.card.showLines("Briefing · Tokyo · " + w.source, lines, "Rehearse")
    this._briefingShown = true
    this.briefingHideAt = getTime() + this.briefingHoldSeconds
    print("DeskCompanionSecretary: briefing (" + w.source + ") " + lines.join(" | "))
  }

  /** Stop a briefing's follow-up line (another button was pressed). */
  public cancelPendingSpeech(): void {
    this.pendingRehearseAt = -1
  }

  private async fetchWeather(): Promise<{source: "live" | "offline"; today: string; tomorrow: string}> {
    const offline = {source: "offline" as "live" | "offline", today: "Sunny 18° / 9° (sample)", tomorrow: "Cloudy 16° / 10° (sample)"}
    const request = (async () => {
      try {
        const r = await this.internetModule.fetch(WEATHER_URL, {method: "GET"})
        if (r.status !== 200) return null
        const j = await r.json()
        const dd = j && j.daily
        if (!dd || !dd.weather_code || dd.weather_code.length < 2) return null
        const fmt = (i: number) => weatherWords(Number(dd.weather_code[i])) + " " + Math.round(dd.temperature_2m_max[i]) + "° / " + Math.round(dd.temperature_2m_min[i]) + "°"
        return {source: "live" as "live" | "offline", today: fmt(0), tomorrow: fmt(1)}
      } catch (e) {
        print("DeskCompanionSecretary: weather request failed: " + e)
        return null
      }
    })()
    const timeout = new Promise<null>((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve(null))
      ev.reset(this.timeoutSeconds)
    })
    const res = await Promise.race([request, timeout])
    return res || offline
  }

  // ───────────────────────────── look it up ─────────────────────────────

  /** Look up button: next preset topic; after the presets, type your own topic. */
  public cycleLookup(): void {
    if (this.controller) this.controller.noteInteraction()
    this.lookupIndex = (this.lookupIndex + 1) % (LOOKUP_TOPICS.length + 1)
    if (this.lookupIndex < LOOKUP_TOPICS.length) this.lookUp(LOOKUP_TOPICS[this.lookupIndex])
    else this.askTopic()
  }

  /** Offer a "Learn more" shortcut for a topic (after she returns the book). */
  public offerLearnMore(topic: string): void {
    this.learnTopic = topic
    this.shortcut = "learn"
    if (this.card) this.card.showLines("Want to know more?", [topic], "Learn more")
    this.briefingHideAt = getTime() + 10
  }

  /** Fetch a real summary (Wikipedia REST API) and show it beside her. */
  public async lookUp(topic: string): Promise<void> {
    if (this.lookupBusy) return
    this.lookupBusy = true
    this.cancelPendingSpeech()
    const r = await this.fetchSummary(topic)
    this._lastLookupTitle = r.title
    this._lookupSource = r.source
    this.shortcut = ""
    if (this.card) {
      this.card.showLines(r.title + " · " + r.source, [r.text, "Source: Wikipedia (CC BY-SA)"], "")
    }
    this.briefingHideAt = getTime() + Math.max(this.briefingHoldSeconds, 12)
    if (this.voice) this.voice.say("live_result", "", {en: "Here's what I found.", ja: "調べてみたよ。"})
    print("DeskCompanionSecretary: look up \"" + topic + "\" -> " + r.title + " (" + r.source + ")")
    this.lookupBusy = false
  }

  /** Free-text topic from the AR keyboard (the editor preview has none: a demo topic is used). */
  private askTopic(): void {
    let typed = ""
    let opened = false
    let inEditor = false
    try {
      inEditor = global.deviceInfoSystem.isEditor()
    } catch (e) {
      inEditor = false
    }
    if (this.card) this.card.showLines("Look it up", ["Type a topic…"], "")
    try {
      require("LensStudio:TextInputModule")
      const options = new TextInputSystem.KeyboardOptions()
      options.enablePreview = true
      options.keyboardType = TextInputSystem.KeyboardType.Text
      options.returnKeyType = TextInputSystem.ReturnKeyType.Search
      options.onTextChanged = (text: string) => {
        typed = text
      }
      options.onReturnKeyPressed = () => {
        global.textInputSystem.dismissKeyboard()
        if (typed.trim().length > 0) this.lookUp(typed.trim())
      }
      options.onKeyboardStateChanged = (isOpen: boolean) => {
        if (isOpen) opened = true
      }
      global.textInputSystem.requestKeyboard(options)
    } catch (e) {
      print("DeskCompanionSecretary: keyboard unavailable: " + e)
    }
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      if (typed.length > 0 || (opened && !inEditor)) return
      try {
        global.textInputSystem.dismissKeyboard()
      } catch (e) {
        // nothing to dismiss
      }
      print("DeskCompanionSecretary: no AR keyboard (preview) — demo topic: " + LOOKUP_DEMO_TOPIC)
      this.lookUp(LOOKUP_DEMO_TOPIC)
    })
    ev.reset(2)
  }

  private async fetchSummary(topic: string): Promise<{title: string; text: string; source: "live" | "offline"}> {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(topic.replace(/ /g, "_"))
    const get = async (withAgent: boolean): Promise<{title: string; text: string} | null> => {
      try {
        const init: any = {method: "GET"}
        if (withAgent) init.headers = {"User-Agent": LOOKUP_USER_AGENT, "Api-User-Agent": LOOKUP_USER_AGENT}
        const r = await this.internetModule.fetch(url, init)
        if (r.status !== 200) return null
        const j = await r.json()
        if (!j || !j.extract) return null
        return {title: String(j.title || topic), text: firstSentences(String(j.extract), 2)}
      } catch (e) {
        print("DeskCompanionSecretary: Wikipedia request failed" + (withAgent ? " (with User-Agent)" : "") + ": " + e)
        return null
      }
    }
    const request = (async () => (await get(true)) || (await get(false)))()
    const timeout = new Promise<null>((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve(null))
      ev.reset(this.timeoutSeconds + 1)
    })
    const res = await Promise.race([request, timeout])
    if (res) return {title: res.title, text: res.text, source: "live"}
    const off = LOOKUP_OFFLINE[topic] || "I can't reach Wikipedia right now, and I don't have a note about that topic."
    return {title: topic, text: off, source: "offline"}
  }

  // ───────────────────────────── timer ─────────────────────────────

  /** Timer button: next preset (restarts the countdown); after the last one the timer is off. */
  public cycleTimer(): void {
    if (this.controller) this.controller.noteInteraction()
    this.presetIndex++
    if (this.presetIndex >= TIMER_PRESETS.length) {
      this.presetIndex = -1
      this._timerKind = ""
      this._timerRemaining = 0
      if (this.card) this.card.hide()
      print("DeskCompanionSecretary: timer off")
      return
    }
    const p = TIMER_PRESETS[this.presetIndex]
    this._timerKind = p.kind
    this._timerRemaining = p.seconds
    this.briefingHideAt = -1
    this.shortcut = ""
    if (this.voice) this.voice.say("timer_set")
    if (this.card) this.card.showCountdown(p.label, p.seconds)
    print("DeskCompanionSecretary: timer -> " + p.label)
  }

  private timerFired(): void {
    const kind = this._timerKind
    this._timerKind = ""
    this._timerRemaining = 0
    this.presetIndex = -1
    if (kind === "stretch") {
      if (this.voice) this.voice.say("reminder_stretch")
      this.shortcut = "stretch"
      if (this.card) this.card.showLines("Reminder", ["Time for a stretch break."], "Stretch")
    } else if (kind === "talk") {
      if (this.voice) this.voice.say("reminder_talk")
      this.shortcut = "rehearse"
      if (this.card) this.card.showLines("Reminder", ["Your talk starts in one minute."], "Rehearse")
    } else {
      if (this.voice) this.voice.say("timer_done")
      this.shortcut = ""
      if (this.card) this.card.showLines("Timer", ["Time's up!"], "")
    }
    this.briefingHideAt = getTime() + 8
    print("DeskCompanionSecretary: timer done (" + kind + ")")
  }

  // ───────────────────────────── music ─────────────────────────────

  /** Music button: Off -> Focus -> Relax -> Off. */
  public cycleMusic(): void {
    if (this.controller) this.controller.noteInteraction()
    const next: MusicTrack = this._musicTrack === "off" ? "focus" : this._musicTrack === "focus" ? "relax" : "off"
    this._musicTrack = next
    const a = this.musicAudio
    if (a) {
      try {
        if (a.isPlaying()) a.stop(false)
      } catch (e) {
        // nothing playing yet
      }
      const track = next === "focus" ? this.musicFocus : next === "relax" ? this.musicRelax : null
      if (track) {
        a.audioTrack = track
        a.volume = this.musicVolume
        a.play(-1)
      } else if (next !== "off") {
        print("DeskCompanionSecretary: no " + next + " track yet (music_" + next + ".mp3) — silent")
      }
    }
    if (this.voice) this.voice.say(next === "off" ? "music_off" : "music_on")
    this.nextSwayAt = getTime() + 6
    print("DeskCompanionSecretary: music -> " + next)
  }

  /** Desk Music slider (0-1). */
  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v))
  }

  // ───────────────────────────── shared ─────────────────────────────

  private onShortcut(): void {
    if (this.card) this.card.hide()
    this.cancelPendingSpeech()
    if (this.shortcut === "rehearse" && this.modes) this.modes.enterMode("cue_cards")
    else if (this.shortcut === "stretch" && this.stretch) this.stretch.start()
    else if (this.shortcut === "learn" && this.learnTopic) this.lookUp(this.learnTopic)
    this.shortcut = ""
  }

  private tick(): void {
    const now = getTime()
    const dt = getDeltaTime()
    if (this.pendingRehearseAt > 0 && now >= this.pendingRehearseAt && !(this.voice && this.voice.isSpeaking)) {
      this.pendingRehearseAt = -1
      if (this.voice) this.voice.say("briefing_rehearse")
    }
    if (this._timerKind !== "") {
      this._timerRemaining -= dt * Math.max(0, this.timeScale)
      if (this.card && this.briefingHideAt < 0) this.card.showCountdown(TIMER_PRESETS[Math.max(0, this.presetIndex)].label, this._timerRemaining)
      if (this._timerRemaining <= 0) this.timerFired()
    }
    if (this.briefingHideAt > 0 && now >= this.briefingHideAt) {
      this.briefingHideAt = -1
      this._briefingShown = false
      if (this.card && this._timerKind === "") this.card.hide()
    }
    // music: duck under her voice; sway now and then while she idles
    if (this.musicAudio && this._musicTrack !== "off") {
      const speaking = !!this.voice && this.voice.isSpeaking
      this.musicAudio.volume = speaking ? Math.min(this.musicVolume, this.musicDuckVolume) : this.musicVolume
      if (!speaking && now >= this.nextSwayAt && this.controller && this.animator) {
        const s = this.controller.state
        if (s === "roam_idle" || s === "attend") this.animator.playOnce("dance")
        this.nextSwayAt = now + 20
      }
    }
  }
}
