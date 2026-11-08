/**
 * DeskCompanionContent — the single, hard-coded content table for the Desk Companion lens.
 *
 * Owns: the shared lines (id, Japanese, English) used in every mode — word explanations, the
 * book, dance / pose — the words on the stand-in foreign-language page (with reading + meaning),
 * and the stand-in book. Per-mode lines (call / tease / leave / cue cards) come from
 * persona/modes.md via the generated DeskCompanionPersonaData.ts and use ids "<modeId>__<key>"
 * (e.g. "sweetheart__tease_2"). findLine() resolves both kinds.
 * She speaks English: `en` is voiced and shown as the big subtitle, `ja` is the small subtitle.
 * Voice files are named after the line id (Assets/Companion/Voice/<id>.mp3 and
 * Assets/Companion/Voice/modes/<modeId>__<key>.mp3).
 *
 * Must not: touch the scene or hold runtime state.
 * No live AI is involved — every answer below is hard-coded per the design brief.
 */

/** One spoken line. `id` is the stable key used by scripts and by the voice-clip slots. */
export interface CompanionLine {
  id: string
  ja: string
  en: string
}

import {PERSONA_MODES, PersonaMode} from "./DeskCompanionPersonaData"

/** A highlighted word on the stand-in foreign-language page. */
export interface PageWord {
  id: string
  /** Exactly as printed on the page. */
  word: string
  /** How to read it (katakana / kana reading for a Japanese learner). */
  reading: string
  meaningJa: string
  meaningEn: string
  /** Line the companion speaks when this word is pinched. */
  lineId: string
  /** Which page font renders the word: "ko" uses the Korean font, everything else the Japanese font. */
  script: "latin" | "ko" | "ja"
}

/** A printed line on the page: plain text segments and highlighted word ids, left to right. */
export interface PageLine {
  script: "latin" | "ko" | "ja"
  segments: Array<{text: string} | {wordId: string}>
}

export const COMPANION_LINES: CompanionLine[] = [
  // English text = what the recorded voice says (avatar-work/voice/lines_en.json); Japanese = small subtitle.
  // Shared fallbacks — used only when the active mode has no line for that moment.
  {id: "call_whats_up", ja: "どうしたの？", en: "Hey, what's up?"},
  {id: "tease_1", ja: "何してるの？ 何か手伝おうか？", en: "Hey... what are you working on? Anything I can help with?"},
  {id: "tease_3", ja: "ずっと頑張ってるね。少し休憩する？", en: "You've been working so hard. How about a little break?"},
  {id: "leave", ja: "じゃあ、ここにいるね。また呼んでね。", en: "Okay, I'll be right here. Just call me if you need me."},

  {id: "word_serendipity", ja: "「セレンディピティ」。思いがけず素敵なものを見つけること。", en: "Serendipity. It means finding something wonderful by happy accident."},
  {id: "word_ephemeral", ja: "「エフェメラル」。ほんの短い間しか続かないもの。", en: "Ephemeral. It means something that lasts only a short moment."},
  {id: "word_nalssi", ja: "韓国語の「날씨（ナルシ）」。天気のことだよ。", en: "That's Korean, nalssi. It means weather."},
  {id: "word_gamsahamnida", ja: "「감사합니다（カムサハムニダ）」。韓国語で「ありがとう」。", en: "Gamsahamnida. That's Korean for thank you."},
  {id: "word_bara", ja: "その漢字は「ばら」。花のバラだよ。", en: "That kanji is read bara. It means rose."},
  {id: "word_yuuutsu", ja: "それは「ゆううつ」。気分が晴れないこと。", en: "That one is yuuutsu. It means gloomy, feeling down."},
  {id: "word_remon", ja: "「れもん」、果物のレモン。かわいい書き方でしょ？", en: "That's remon, a lemon. Cute way to write it, right?"},
  {id: "word_kajiru", ja: "「かじる」。少しずつかむこと。", en: "That's kajiru. It means to take a little bite."},

  {id: "book_received", ja: "あ、本？ ちょっと読んでみるね。", en: "Oh, a book for me? Let me take a look."},
  {
    id: "book_summary",
    ja: "『不思議の国のアリス』。白いウサギを追いかけて穴に落ちた女の子が、ふしぎな国で変な住人たちに出会うお話。楽しかった！",
    en: "Alice's Adventures in Wonderland. A girl follows a white rabbit down a hole into a strange land full of odd characters. That was so much fun!"
  },
  {id: "book_return", ja: "はい、返すね。ありがとう、すごく良かった。", en: "Here you go. Thank you, I loved it."},

  {id: "dance", ja: "あなたのためだけに、ちょっとだけ踊るね！", en: "Okay, just a little dance, just for you!"},
  {id: "pose", ja: "こんな感じ？", en: "Like this?"},

  // "Ask" button answers (sample data in the preview; persona/modes.md Secretary "質問に答える")
  {id: "ask_weather", ja: "明日は晴れ。最高18度、最低9度。お散歩日和だよ。", en: "Tomorrow looks sunny. High of 18, low of 9. Perfect for a walk."},
  {id: "ask_plan", ja: "今日は3つ。スライドの仕上げ、お客さんへの返信、4時に電話。", en: "You have three things today: finish the slides, reply to the client, and a call at four."},
  {id: "ask_project", ja: "プロジェクトは3つの小さな段階に分けて、今日は一番簡単なところから始めよう。", en: "Let's break the project into three small steps, and start with the easiest one today."},

  // Live translation (DeskCompanionTranslator)
  {id: "live_prompt", ja: "何でも入力してね。翻訳してあげる。", en: "Type anything you want, and I'll translate it for you."},
  {id: "live_result", ja: "こういう意味だよ。", en: "Here's what that means."},
  {id: "live_offline", ja: "うーん、今は翻訳サービスにつながらないみたい。でも、知ってることを教えるね。", en: "Hmm, I can't reach the translator right now. But here's what I know."},

  // Poked / pinched (same in every mode; no body-part zones on purpose)
  {id: "poke_tickle", ja: "くすぐったいよ！", en: "Hey, that tickles!"},
  {id: "poke_annoyed", ja: "もう、やめて！", en: "Okay, that's enough. Hands off!"},
  {id: "poke_forgive", ja: "もう…許してあげる。", en: "Hmph... fine. I forgive you."},
  // Stretch break (English = exactly what the stretch_*.mp3 recordings say)
  {id: "stretch_intro", ja: "一緒にちょっとストレッチしよう。まねしてね！", en: "Let's take a quick stretch break together. Follow me!"},
  {id: "stretch_arms_up", ja: "腕を上げて、伸ばして。1、2、3、4。", en: "Arms up, and stretch. One, two, three, four."},
  {id: "stretch_side", ja: "横に倒して。1、2、3、4。反対側も。", en: "Now lean to the side. One, two, three, four. And the other side."},
  {id: "stretch_shoulders", ja: "肩を後ろに、ゆっくり回して。1、2、3、4。", en: "Roll your shoulders back, nice and slow. One, two, three, four."},
  {id: "stretch_neck", ja: "首をやさしく傾けて。1、2、3、4。反対側も。", en: "Gently tilt your head. One, two, three, four. And the other way."},
  {id: "stretch_done", ja: "おつかれさま！すっきりした？ さあ仕事に戻ろう、きっとできるよ。", en: "Great job! Feel better? Back to work, you've got this."},
  // Briefing / timers / music
  {id: "briefing_intro", ja: "おはよう！今日の予定だよ。", en: "Good morning! Here's your day."},
  {id: "briefing_rehearse", ja: "今日は発表があるね。一緒にリハーサルする？", en: "You have a talk today. Want to rehearse it with me?"},
  {id: "timer_set", ja: "了解、タイマーをセットしたよ。", en: "Okay, timer's on."},
  {id: "timer_done", ja: "時間だよ！", en: "Time's up!"},
  {id: "reminder_stretch", ja: "ストレッチの時間だよ。一緒にやる？", en: "It's time for a stretch break. Want to stretch with me?"},
  {id: "reminder_talk", ja: "もうすぐ発表、あと1分だよ。", en: "Heads up, your talk starts in one minute."},
  {id: "music_on", ja: "一緒に何か聴こう。", en: "Let's listen to something together."},
  {id: "music_off", ja: "了解、音楽を止めるね。", en: "Okay, music off."},
  {id: "music_mine", ja: "あなたの曲、かけるね。", en: "Here's your song."},
  {id: "music_mine_fail", ja: "うーん、曲を読み込めなかった。リンクを確認してみて？", en: "Hmm, I couldn't load your song. Can you check the link?"}
]

/** Separator between mode id and line key in per-mode line ids ("sweetheart__tease_1"). */
export const MODE_LINE_SEP = "__"

/** Id of a per-mode line, e.g. modeLineId("smart", "call") === "smart__call". */
export function modeLineId(modeId: string, key: string): string {
  return modeId + MODE_LINE_SEP + key
}

/** Shared tease fallbacks (when a mode defines no tease lines of its own). */
export const SHARED_TEASE_LINE_IDS: string[] = ["tease_1", "tease_3"]

/** Every line id that can be used for a tease, across all modes (shared + per mode). */
export const TEASE_LINE_IDS: string[] = SHARED_TEASE_LINE_IDS.concat(
  ...PERSONA_MODES.map((m) => ["tease_1", "tease_2", "tease_3"].filter((k) => !!m.lines[k]).map((k) => modeLineId(m.id, k)))
)

export const PAGE_WORDS: PageWord[] = [
  {id: "serendipity", word: "serendipity", reading: "セレンディピティ", meaningJa: "思いがけない幸運な発見", meaningEn: "a lucky, unexpected discovery", lineId: "word_serendipity", script: "latin"},
  {id: "ephemeral", word: "ephemeral", reading: "エフェメラル", meaningJa: "はかない・つかの間の", meaningEn: "lasting a very short time", lineId: "word_ephemeral", script: "latin"},
  {id: "nalssi", word: "날씨", reading: "ナルシ (nalssi)", meaningJa: "天気", meaningEn: "weather", lineId: "word_nalssi", script: "ko"},
  {id: "gamsahamnida", word: "감사합니다", reading: "カムサハムニダ", meaningJa: "ありがとうございます", meaningEn: "thank you", lineId: "word_gamsahamnida", script: "ko"},
  {id: "bara", word: "薔薇", reading: "ばら (bara)", meaningJa: "バラ（花）", meaningEn: "rose", lineId: "word_bara", script: "ja"},
  {id: "yuuutsu", word: "憂鬱", reading: "ゆううつ (yūutsu)", meaningJa: "気分が晴れないこと", meaningEn: "gloom, melancholy", lineId: "word_yuuutsu", script: "ja"},
  {id: "remon", word: "檸檬", reading: "れもん (remon)", meaningJa: "レモン（果物）", meaningEn: "lemon", lineId: "word_remon", script: "ja"},
  {id: "kajiru", word: "齧る", reading: "かじる (kajiru)", meaningJa: "少しずつかむ", meaningEn: "to bite, to nibble", lineId: "word_kajiru", script: "ja"}
]

export const PAGE_LINES: PageLine[] = [
  {script: "latin", segments: [{text: "It was pure"}, {wordId: "serendipity"}, {text: "."}]},
  {script: "latin", segments: [{text: "Cherry blossoms are"}, {wordId: "ephemeral"}, {text: "."}]},
  {script: "ko", segments: [{text: "오늘"}, {wordId: "nalssi"}, {text: "가 좋네요."}]},
  {script: "ko", segments: [{text: "정말"}, {wordId: "gamsahamnida"}, {text: "."}]},
  {script: "ja", segments: [{text: "窓辺の"}, {wordId: "bara"}, {text: "が"}, {wordId: "yuuutsu"}, {text: "を払う。"}]},
  {script: "ja", segments: [{wordId: "remon"}, {text: "を一つ"}, {wordId: "kajiru"}, {text: "。"}]}
]

/** One "Ask" answer: the spoken line plus the short card shown beside her (all sample data). */
export interface AskItem {
  id: string
  lineId: string
  glyph: string
  card: string
}

/** Each press of the Ask button cycles these (weather -> today's plan -> project tip). */
export const ASK_ITEMS: AskItem[] = [
  {id: "ask_weather", lineId: "ask_weather", glyph: "☀", card: "Tomorrow: Sunny 18° / 9°"},
  {id: "ask_plan", lineId: "ask_plan", glyph: "★", card: "Today: 1) Slides  2) Reply to client  3) Call at 4pm"},
  {id: "ask_project", lineId: "ask_project", glyph: "→", card: "Project: 1) Goal  2) Draft  3) Review"}
]

/** The stand-in book on the desk (title printed on its cover is authored in the scene). */
export const BOOK = {
  // Public domain: Lewis Carroll, 1865. Plain title text only — no cover artwork from any edition.
  titleEn: "Alice's Adventures in Wonderland",
  titleJa: "不思議の国のアリス",
  receivedLineId: "book_received",
  summaryLineId: "book_summary",
  returnLineId: "book_return"
}

export function findLine(id: string): CompanionLine | null {
  for (const l of COMPANION_LINES) {
    if (l.id === id) return l
  }
  const i = id.indexOf(MODE_LINE_SEP)
  if (i > 0) {
    const modeId = id.substring(0, i)
    const key = id.substring(i + MODE_LINE_SEP.length)
    for (const m of PERSONA_MODES) {
      if (m.id === modeId && m.lines[key]) return {id, ja: m.lines[key].ja, en: m.lines[key].en}
    }
  }
  return null
}

/** The active mode's line id for a moment ("call", "tease_1", "leave", "cue_next", ...), or a shared fallback. */
export function lineIdForMode(mode: PersonaMode | null, key: string, fallbackId: string): string {
  return mode && mode.lines[key] ? modeLineId(mode.id, key) : fallbackId
}

export function findWord(id: string): PageWord | null {
  for (const w of PAGE_WORDS) {
    if (w.id === id) return w
  }
  return null
}
