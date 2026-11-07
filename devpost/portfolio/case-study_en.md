# Portfolio text (Fiverr gig gallery / portfolio): Yorisoi

掲載メモ（ここは貼らない）
- 本文（「---」の間）は約250語。Highlights は5行。
- Fiverr のポートフォリオ項目にそのまま貼れる。ギャラリー画像は `devpost/portfolio/assets-todo.md` のヒーロー画像・翻訳カード・カンペがおすすめ。
- ハッカソンの結果が出るまで、受賞などは書かない。

**Title:** Yorisoi: an AI companion Lens for Snap SPECS AR glasses

---

Yorisoi is an AR companion Lens I designed and built for Snap SPECS glasses, as an entry to the Devpost hackathon "Learn AR with SPECS."

While you work at your desk, a life-size, photoreal companion stays in front of you, just to the side of your work. Pinch a word you can't read on a foreign-language page (English, Korean or difficult kanji) and its reading and meaning appear right next to the word. Hand her a book and she gives you a short summary. For presentations, she holds your talking points as big cue cards beside her. Six personality modes change how she talks, how often she checks in and how she moves.

**What I did:** concept and spatial UX design, directing AI coding agents (Snap's CLAD working in Lens Studio through the MCP server), reviewing the TypeScript architecture, producing the AI-generated character video and voice, setting up LEAF test scenarios in the Lens Studio preview, and writing the documentation.

**Problems I solved:** the glasses show only a narrow window, so I designed a lazy head-follow that glides her back into view instead of locking her to your face. The display is additive (black is transparent), so a video filmed on black reads as a person standing in your room. When an antivirus filter silently broke the agents' connection to Lens Studio, I traced it to corrupted local HTTP responses and wrote a small stdio bridge to fix it.

Need an AR prototype, a Lens Studio or Spectacles Lens, or an AI-agent build workflow? I can help.

**Highlights**

- Spatial UX for a narrow field of view: she always stays in front of you, never behind
- Translation on the page itself: pinch an English, Korean or kanji word
- Photoreal video character tuned for an additive display
- Whole personality in one Markdown file: six modes, including presentation cue cards
- AI-agent pipeline: plan-lens → CLAD → Lens Studio MCP → LEAF tests

---
