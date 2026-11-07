/**
 * DeskCompanionTranslator — real translation with the hard-coded table as fallback.
 *
 * Service: MyMemory free API (no key, no account):
 *   GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>
 *   -> JSON responseData.translatedText
 * Only the text the user chose (a pinched word, or what they typed) is sent — no email, no
 * device or user data. Results are cached per text + language pair (anonymous limit ~5000 chars/day).
 * Each request times out after `timeoutSeconds` (~3 s); then the offline answer is used.
 *
 *   translateWord(word)   -> live meaning(s) for a pinched page word (en->ja, ko->en + ko->ja, ja->en);
 *                            the caller keeps her pre-recorded explanation line and the table answer.
 *   openFreeInput()       -> she says live_prompt, the Specs AR keyboard opens; on submit the text is
 *                            translated into the other two languages and shown on the card beside her
 *                            with live_result (or live_offline + "couldn't reach the translator").
 *                            The AR keyboard does not appear in Lens Studio Preview with SPECS 27, so if
 *                            it has not opened after `keyboardFallbackSeconds`, a sample phrase is used
 *                            (labelled "demo text") so the flow can still be shown and tested.
 *   translateFreeText(t)  -> the same flow without the keyboard (tests / scripted demos).
 *
 * Test hooks: lastTranslationSource ("live" | "offline"), lastTranslationText, isBusy.
 * Must not: build UI (DeskCompanionTranslateCardUI does) or hold page / companion state.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DeskCompanionVoice} from "./DeskCompanionVoice"
import {DeskCompanionController} from "./DeskCompanionController"
import {DeskCompanionTranslateCardUI, ScriptKind} from "./DeskCompanionTranslateCardUI"
import {PageWord} from "./DeskCompanionContent"

export type TranslationSource = "live" | "offline"

export interface WordTranslation {
  source: TranslationSource
  meaningEn: string
  meaningJa: string
}

const DEMO_PHRASES = ["Thank you for your help today.", "今日はいい天気ですね。", "감사합니다"]

@component
export class DeskCompanionTranslator extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionTranslator – live translation (MyMemory) + offline fallback</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Voice + subtitles (live_prompt / live_result / live_offline)")
  voice: DeskCompanionVoice

  @input
  @hint("Companion controller (typing / translating counts as interaction)")
  controller: DeskCompanionController

  @input
  @hint("Card beside her for free-text translations")
  card: DeskCompanionTranslateCardUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(1, 10, 0.5))
  @hint("Give up on the live translator after this many seconds and use the offline answer")
  timeoutSeconds: number = 3

  @input
  @widget(new SliderWidget(4, 20, 0.5))
  @hint("Seconds the free-text translation card stays beside her")
  cardHoldSeconds: number = 10

  @input
  @widget(new SliderWidget(0.5, 5, 0.5))
  @hint("If the AR keyboard has not opened after this long (e.g. Lens Studio Preview), use a demo phrase")
  keyboardFallbackSeconds: number = 2
  @ui.group_end

  private internetModule: InternetModule = require("LensStudio:InternetModule")
  private cache: Record<string, string> = {}
  private _lastSource: TranslationSource = "offline"
  private _lastText = ""
  private busy = false
  private typed = ""
  private keyboardOpened = false
  private demoIndex = 0
  private cardHideAt = -1
  private _onCardShown = new Event<void>()

  /** Fires when the free-text card is shown (Main hides the Ask card then). */
  get onCardShown(): PublicApi<void> { return this._onCardShown.publicApi() }

  public get lastTranslationSource(): TranslationSource { return this._lastSource }
  public get lastTranslationText(): string { return this._lastText }
  public get isBusy(): boolean { return this.busy }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      if (this.cardHideAt > 0 && getTime() >= this.cardHideAt) {
        this.cardHideAt = -1
        if (this.card) this.card.hide()
      }
    })
  }

  public hideCard(): void {
    this.cardHideAt = -1
    if (this.card) this.card.hide()
  }

  // ───────────────────────── page words ─────────────────────────

  /** Live meaning(s) for a pinched page word, or the table answer when offline. */
  public async translateWord(w: PageWord): Promise<WordTranslation> {
    let en = w.meaningEn
    let ja = w.meaningJa
    let live = false
    if (w.script === "latin") {
      const r = await this.translate(w.word, "en", "ja")
      if (r) { ja = r; live = true }
    } else if (w.script === "ko") {
      const [rEn, rJa] = await Promise.all([this.translate(w.word, "ko", "en"), this.translate(w.word, "ko", "ja")])
      if (rEn) { en = rEn; live = true }
      if (rJa) { ja = rJa; live = true }
    } else {
      const r = await this.translate(w.word, "ja", "en")
      if (r) { en = r; live = true }
    }
    this._lastSource = live ? "live" : "offline"
    this._lastText = en + " / " + ja
    print("DeskCompanionTranslator: word " + w.id + " -> " + this._lastText + " (" + this._lastSource + ")")
    return {source: this._lastSource, meaningEn: en, meaningJa: ja}
  }

  // ───────────────────────── free text ─────────────────────────

  /** "Translate…": she asks you to type, the AR keyboard opens; on submit she translates it. */
  public openFreeInput(): void {
    if (this.controller) this.controller.noteInteraction()
    if (this.voice) this.voice.say("live_prompt")
    this.typed = ""
    this.keyboardOpened = false
    try {
      require("LensStudio:TextInputModule")
      const options = new TextInputSystem.KeyboardOptions()
      options.enablePreview = true
      options.keyboardType = TextInputSystem.KeyboardType.Text
      options.returnKeyType = TextInputSystem.ReturnKeyType.Done
      options.onTextChanged = (text: string) => {
        this.typed = text
      }
      options.onReturnKeyPressed = () => {
        const t = this.typed
        global.textInputSystem.dismissKeyboard()
        if (t.trim().length > 0) this.translateFreeText(t)
      }
      options.onKeyboardStateChanged = (isOpen: boolean) => {
        if (isOpen) this.keyboardOpened = true
      }
      options.onError = (error: number, description: string) => {
        print("DeskCompanionTranslator: keyboard error " + error + " " + description)
      }
      global.textInputSystem.requestKeyboard(options)
    } catch (e) {
      print("DeskCompanionTranslator: keyboard unavailable: " + e)
    }
    // Lens Studio Preview with SPECS 27 has no AR keyboard: fall back to a demo phrase
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      if (this.keyboardOpened || this.typed.length > 0) return
      const phrase = DEMO_PHRASES[this.demoIndex % DEMO_PHRASES.length]
      this.demoIndex++
      print("DeskCompanionTranslator: no AR keyboard (preview) — using demo text: " + phrase)
      this.translateFreeText(phrase, true)
    })
    ev.reset(this.keyboardFallbackSeconds)
  }

  /** Translate free text into the other two languages and show it beside her. */
  public async translateFreeText(text: string, isDemo: boolean = false): Promise<void> {
    if (this.busy) return
    this.busy = true
    if (this.controller) this.controller.noteInteraction()
    const src = DeskCompanionTranslator.detectScript(text)
    const targets: ScriptKind[] = src === "en" ? ["ja", "ko"] : src === "ja" ? ["en", "ko"] : ["en", "ja"]
    // primary (large) = English, or Japanese when the text is English; secondary (small) = the third language
    const [a, b] = await Promise.all([this.translate(text, src, targets[0]), this.translate(text, src, targets[1])])
    const live = !!a || !!b
    let primary = a || ""
    let secondary = b || ""
    let secondaryScript: ScriptKind = targets[1]
    const tag = (live ? "live" : "offline") + (isDemo ? " · demo text" : "")
    if (!live) {
      primary = "Couldn't reach the translator."
      secondary = "翻訳サービスにつながりませんでした"
      secondaryScript = "ja"
      if (this.voice) this.voice.say("live_offline")
    } else if (this.voice) {
      this.voice.say("live_result")
    }
    this._lastSource = live ? "live" : "offline"
    this._lastText = [primary, secondary].filter((s) => s.length > 0).join(" / ")
    if (this.card) {
      this.card.showTranslation(text, src, primary, secondary, secondaryScript, tag)
      this.cardHideAt = getTime() + this.cardHoldSeconds
      this._onCardShown.invoke()
    }
    print("DeskCompanionTranslator: free text \"" + text + "\" (" + src + ") -> " + this._lastText + " (" + tag + ")")
    this.busy = false
  }

  /** Hangul -> ko, kana / kanji -> ja, anything else -> en. */
  public static detectScript(text: string): ScriptKind {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) return "ko"
    }
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff66 && c <= 0xff9f)) return "ja"
    }
    return "en"
  }

  // ───────────────────────── MyMemory ─────────────────────────

  /** One request (cached); resolves "" on failure or timeout. */
  private async translate(text: string, src: ScriptKind, tgt: ScriptKind): Promise<string> {
    const pair = src + "|" + tgt
    const key = text + "\u0001" + pair
    if (this.cache[key] !== undefined) return this.cache[key]
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + encodeURIComponent(pair)
    const request = (async (): Promise<string> => {
      try {
        const response = await this.internetModule.fetch(url, {method: "GET"})
        if (response.status !== 200) return ""
        const json = await response.json()
        const out = json && json.responseData && json.responseData.translatedText ? String(json.responseData.translatedText) : ""
        // MyMemory reports quota / errors inside translatedText in upper case; treat those as failures
        if (!out || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/i.test(out)) return ""
        return out
      } catch (e) {
        print("DeskCompanionTranslator: request failed: " + e)
        return ""
      }
    })()
    const timeout = new Promise<string>((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve(""))
      ev.reset(this.timeoutSeconds)
    })
    const result = await Promise.race([request, timeout])
    if (result) this.cache[key] = result
    return result
  }
}
