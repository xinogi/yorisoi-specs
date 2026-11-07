/**
 * DeskCompanionContent — the single, hard-coded content table for the Desk Companion lens.
 *
 * Owns: every line the companion can say (id, Japanese, English), the words on the
 * stand-in foreign-language page (with reading + meaning), and the stand-in book.
 * Edit THIS file to change what she says or what the page shows. Voice audio for each
 * line id is dropped onto the matching slot of DeskCompanionVoice in the Inspector.
 *
 * Must not: touch the scene, hold runtime state, or depend on any other script.
 * No live AI is involved — every answer below is hard-coded per the design brief.
 */

/** One spoken line. `id` is the stable key used by scripts and by the voice-clip slots. */
export interface CompanionLine {
  id: string
  ja: string
  en: string
}

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
  {id: "call_whats_up", ja: "どうしたの？", en: "What's up?"},
  {id: "tease_1", ja: "何してるの？ 何か手伝おうか？", en: "What are you doing? Anything I can do?"},
  {id: "tease_2", ja: "何か食べたいものある？", en: "Want something to eat?"},
  {id: "tease_3", ja: "ずっと頑張ってるね。少し休憩する？", en: "You've been at it a while. Take a break?"},
  {id: "leave", ja: "じゃあ、また呼んでね。", en: "Okay, call me if you need me."},

  {id: "word_serendipity", ja: "「セレンディピティ」。思いがけない幸運な発見、って意味だよ。", en: "\"Serendipity\" — a lucky, unexpected discovery."},
  {id: "word_ephemeral", ja: "「エフェメラル」。はかない、すぐに消えてしまうって意味。", en: "\"Ephemeral\" — lasting only a very short time."},
  {id: "word_nalssi", ja: "「날씨（ナルシ）」は韓国語で「天気」だよ。", en: "\"날씨 (nalssi)\" is Korean for \"weather\"."},
  {id: "word_gamsahamnida", ja: "「감사합니다（カムサハムニダ）」は「ありがとうございます」。", en: "\"감사합니다 (gamsahamnida)\" means \"thank you\"."},
  {id: "word_bara", ja: "「薔薇」は「ばら」って読むの。花のバラだよ。", en: "\"薔薇\" is read \"bara\" — a rose."},
  {id: "word_yuuutsu", ja: "「憂鬱」は「ゆううつ」。気分が晴れないこと。", en: "\"憂鬱\" is read \"yūutsu\" — gloom, feeling down."},
  {id: "word_remon", ja: "「檸檬」は「れもん」。果物のレモンだね。", en: "\"檸檬\" is read \"remon\" — a lemon."},
  {id: "word_kajiru", ja: "「齧る」は「かじる」。少しずつかむこと。", en: "\"齧る\" is read \"kajiru\" — to take a bite, to nibble."},

  {id: "book_received", ja: "あ、本？ ちょっと読んでみるね。", en: "Oh, a book? Let me take a look."},
  {
    id: "book_summary",
    ja: "『不思議の国のアリス』は、白いウサギを追いかけて穴に落ちた女の子が、ふしぎな国で変な住人たちに出会うお話。読んでて楽しかった！",
    en: "\"Alice's Adventures in Wonderland\": a girl follows a white rabbit down a hole into a strange land full of odd characters. Such a fun read!"
  },
  {id: "book_return", ja: "はい、返すね。素敵な本だった。", en: "Here you go. That was a lovely book."},

  {id: "dance", ja: "ちょっとだけ踊るね！", en: "Just a little dance!"},
  {id: "pose", ja: "こんな感じ？", en: "Like this?"}
]

/** Line ids picked at random when she comes over to tease after a quiet stretch. */
export const TEASE_LINE_IDS: string[] = ["tease_1", "tease_2", "tease_3"]

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
  return null
}

export function findWord(id: string): PageWord | null {
  for (const w of PAGE_WORDS) {
    if (w.id === id) return w
  }
  return null
}
