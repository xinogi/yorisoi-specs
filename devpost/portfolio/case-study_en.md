# Portfolio text (Fiverr gig gallery / portfolio): Yorisoi

掲載メモ（ここは貼らない）
- 本文（「---」の間）は約290語。Highlights は5行。
- Fiverr のポートフォリオ項目にそのまま貼れる。ギャラリー画像は `devpost/portfolio/assets-todo.md` のヒーロー画像・翻訳カード・カンペがおすすめ。
- briefing・reminders・music は 2026-11-08 時点で追加中。完成版に入らなかった物は、貼る前に本文と Highlights から消す。
- テスト合格数（eight / 8）は、DC9・DC10 が合格したら書き換える。
- ハッカソンの結果が出るまで、受賞などは書かない。

**Title:** Yorisoi: an AI companion Lens for Snap SPECS AR glasses

---

Yorisoi is an AR companion Lens I designed and built for Snap SPECS glasses, as an entry to the Devpost hackathon "Learn AR with SPECS." The concept: your girlfriend and a super-capable secretary, in your real space.

While you work at your desk, a life-size, photoreal companion stands in front of you, just to the side of your work, and stays quiet until you call her. For presentations, she keeps your whole talk list in view, with the current point, a delivery note and a time bar, and whispers if you run long. Only the wearer can see the cards. Pinch a word you can't read on a foreign-language page (English, Korean or kanji) and a live translation appears right next to it. She also gives a briefing with real weather, sets reminders, leads a stretch break, listens to music with you, and can switch to voice only. Six personality modes live in one editable Markdown file.

**What I did:** concept and spatial UX design, directing AI coding agents (Snap's CLAD working in Lens Studio through the MCP server), reviewing the TypeScript architecture, producing the AI-generated character video and voice, designing LEAF test scenarios (eight passing in the preview), and writing the documentation.

**Problems I solved:** a lazy head-follow keeps her inside the glasses' narrow view without locking her to your face. Video filmed on black reads as a person standing in your room on the additive display. When an antivirus filter silently broke the agents' connection to Lens Studio, I traced it to corrupted local HTTP responses and wrote a small stdio bridge to fix it.

Need an AR prototype, a Lens Studio or Spectacles Lens, or an AI-agent build workflow? I can help.

**Highlights**

- Private cue cards: a full talk list with timing and coaching that only the wearer sees
- Live translation on the page itself, with an offline fallback
- Companion and secretary in one: briefing with real weather, reminders, stretch break, music together
- Photoreal video character tuned for an additive display, with a voice-only option
- AI-agent pipeline: plan-lens → CLAD → Lens Studio MCP → LEAF (8 scenarios passing)

---
