# NOTICE: third-party and generated assets

This file lists everything in the Yorisoi repository that was not written by hand for this project, with its source and license. Items still marked **[要確認]** (to be verified) have not been checked against the original license text yet.

Last updated: 2026-11-08

## 1. This project's own content

| What | Where | Author | License |
|---|---|---|---|
| TypeScript behavior scripts | `Assets/Scripts/DeskCompanion*.ts` | Xinogi Studio (しのぎ). Built with CLAD (Snap's Lens Studio agents) under the author's direction | **All rights reserved** (see [LICENSE](LICENSE)) |
| Persona definitions, lines, cue cards | `persona/`, `Assets/Scripts/DeskCompanionContent.ts` | Xinogi Studio | **All rights reserved** (see [LICENSE](LICENSE)) |
| Foreign-language page (example sentences and word explanations) | `Assets/Scripts/DeskCompanionContent.ts` | Xinogi Studio (original short examples) | **All rights reserved** (see [LICENSE](LICENSE)) |
| Tools | `tools/build_persona.py`, `tools/ls_mcp_bridge.py` | Xinogi Studio | **All rights reserved** (see [LICENSE](LICENSE)) |
| Docs | `README.md`, `devpost/` | Xinogi Studio | **All rights reserved** (see [LICENSE](LICENSE)) |

## 2. Snap packages and template

| Package | Where | Publisher | License |
|---|---|---|---|
| Spectacles Interaction Kit (SIK) | `Packages/SpectaclesInteractionKit.lspkg` | Snap Inc. | Snap Inc. terms (Lens Studio / Spectacles). Included because the hackathon asks for the whole Lens Studio project in a public repo; not covered by this repo's own license. |
| Spectacles UI Kit | `Packages/SpectaclesUIKit.lspkg` | Snap Inc. | Snap Inc. terms (Lens Studio / Spectacles). Included because the hackathon asks for the whole Lens Studio project in a public repo; not covered by this repo's own license. |
| LEAF (testing framework) | `Packages/Leaf.lspkg` | Snap Inc. | Snap Inc. terms (Lens Studio / Spectacles). Included because the hackathon asks for the whole Lens Studio project in a public repo; not covered by this repo's own license. |
| Bitmoji 3D (dependency declared by LEAF) | `Packages/Bitmoji 3D.lsc` | Snap Inc. | Snap Inc. terms (Lens Studio / Spectacles). Included because the hackathon asks for the whole Lens Studio project in a public repo; not covered by this repo's own license. |
| Specs Base Template (project starting point) | whole project, created from Lens Studio 5.24.1 | Snap Inc. | Snap Inc. terms (Lens Studio / Spectacles). Included because the hackathon asks for the whole Lens Studio project in a public repo; not covered by this repo's own license. |

Code inside SIK that carries its own notice:

- `OneEuroFilter.ts` (inside the SIK package): Copyright 2019 Inria, author Gery Casiez, **BSD 3-Clause License**. The notice is kept unchanged in the source file inside the package.

## 3. Fonts

| Font | Where | Copyright (from the font's own name table) | License |
|---|---|---|---|
| Noto Sans JP (Medium) | `Assets/Fonts/NotoSansJP-Medium.ttf` | © 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. | **SIL Open Font License 1.1** |
| Noto Sans KR (Medium) | `Assets/Fonts/NotoSansKR-Medium.ttf` | © 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. | **SIL Open Font License 1.1** |

Notes:

- Both files are subsets made from Noto Sans JP / KR fonts installed on Windows. **[要確認]** Confirm the exact source files and versions. The files' internal names still read `NotoSansJP-Thin` / `NotoSansKR-Thin` with style "Regular", which suggests they were cut from the variable font; check that the Medium weight was applied as intended.
- Under the OFL, a modified version must not use the Reserved Font Name ("Source"). The subsets are named "Noto Sans JP" / "Noto Sans KR", which do not use it. **[要確認]**
- The OFL requires every copy to include the copyright notice and the license. The notice is in the fonts' metadata, but the full license text is not in the repo yet. Done: the full SIL OFL 1.1 text is in [`licenses/OFL-NotoSans.txt`](licenses/OFL-NotoSans.txt). (Originally planned: add `OFL.txt` (the full SIL OFL 1.1 text) to the repository.**
- License text: https://openfontlicense.org/

## 4. Icons

| Icons | Where | Source | License |
|---|---|---|---|
| `g_translate`, `menu_book`, `music_note`, `photo_camera`, `waving_hand` (PNG) | `Assets/Icons/` | Google Material Icons | **Apache License 2.0** |

- **[要確認]** Confirm whether these came from Material Icons or Material Symbols (both are Apache-2.0) and record the source.
- Apache-2.0 does not grant trademark rights. `g_translate` shows a stylized "G". **[要確認]** Consider the generic `translate` icon instead.
- License text: https://www.apache.org/licenses/LICENSE-2.0

## 5. Sound effects

| Files | Where | How they were made | License |
|---|---|---|---|
| `CompanionAttentionChime`, `CompanionFootstep1`, `CompanionFootstep2`, `CompanionPageFlip`, `CompanionSparkle`, `UIClickSoft` (.wav) | `Assets/GeneratedSFX/` | Synthesized locally with CLAD's `build-sfx` skill (algorithmic synthesis; no recorded samples) | Original work by Xinogi Studio. All rights reserved (see [LICENSE](LICENSE)) |

## 6. Character images and videos (AI-generated)

The companion is a **fictional person**. She is not a real person and is not made to look like any real or famous person. No real person's photo was used as a reference.

| What | Where | How it was made | Rights / license |
|---|---|---|---|
| Final character stills and clips | `Assets/Companion/Clips/`, `persona/characters/<name>/` | Generated by the author with AI: **Meta Muse** | The user keeps ownership of the output under the Muse supplemental terms, §2.1. **[要確認]** Re-check the exact wording and its date at submission time, and record any attribution or labelling requirement. Yori's final clips are **not in this repo** (placeholders only); they appear in the demo video, which is labelled as AI-generated on YouTube |
| Fallback clips | same | **Z-Image-Turbo** (still image) → **Wan2.2** (image-to-video), generated locally | Both models are released under the **Apache License 2.0**. The clips are the author's output. **[要確認]** Record the exact model versions used |
| Placeholder clips (current) | `Assets/Companion/Clips/*.mp4` | Created during the first CLAD build as stand-ins | **[要確認]** Record how the placeholders were produced. They will be replaced by the final clips |

## 7. Voice lines

| What | Where | How it was made | Rights / license |
|---|---|---|---|
| English voice lines (pre-recorded) | Assigned to the line slots of `DeskCompanionVoice` (to be added) | Generated with **Google Gemini TTS** | **[要確認]** Check the Gemini API terms of service and usage policy for generated audio: ownership, commercial use, and any disclosure requirement for synthetic voices |

## 8. Text and books

| What | Where | Source | Status |
|---|---|---|---|
| *Alice's Adventures in Wonderland* (title on the stand-in book) | scene, `Assets/Scripts/DeskCompanionContent.ts` | Lewis Carroll, 1865 | **Public domain.** Only the title is used, as plain text. No cover art or illustrations from any edition are used. |
| Her summary of the book | `Assets/Scripts/DeskCompanionContent.ts` | Written by Xinogi Studio | Original wording, not quoted from the book |

## 9. Planning and build tools (not shipped in the Lens)

| Tool | Where | Notes |
|---|---|---|
| plan-lens skill pack | not included | Provided for the Learn AR with SPECS hackathon | Not redistributed here (no license file in the pack). Get it from the hackathon resources page: https://learn-specs.devpost.com/resources |
| Lens Studio 5.24.1, CLAD, Lens Studio MCP server, LEAF | (not in the repo, except the LEAF package above) | Snap Inc. Used under Snap's terms |
| `AGENTS.md` | repo root | Partly auto-generated by Lens Studio (the "Lens Studio managed" block) |

---

## 公開前チェック（作者メモ・解消したらこの節ごと削除）

- [ ] SIK / UI Kit / LEAF / Bitmoji 3D / Specs Base Template のライセンス文言を Snap の公式ドキュメントで確認して、表に書く
- [ ] フォント: 元ファイル（Windows のどのフォントか・版）を確認し、`OFL.txt`（SIL OFL 1.1 全文）をリポジトリに入れる
- [ ] アイコン: Material Icons か Material Symbols かを確認。`g_translate` を `translate` に替えるか決める
- [ ] Meta Muse の補足規約 §2.1 を提出日時点で読み直し、表示義務の有無を書く
- [ ] Z-Image-Turbo / Wan2.2 の使った版を書く（予備クリップを使う場合）
- [ ] 仮のキャラクター動画をどう作ったか確認する（最終版に差し替えるなら行ごと削除）
- [ ] Google Gemini TTS の利用規約（生成音声の権利・商用利用・合成音声の表示義務）を確認する
- [ ] plan-lens スキルパックを公開リポジトリに含めてよいか（配布条件）を確認する
- [x] このプロジェクト自体のライセンス＝全権利保持（閲覧と大会の審査・試用のみ許可）。2026-11-08 本人決定（MIT から変更：まねされたくない）

## Live data sources (fetched at runtime, not bundled)

- **Wikipedia REST API** (page summaries for "Look it up"): text by Wikipedia contributors, licensed CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ . The Lens shows "Source: Wikipedia (CC BY-SA)" on every summary card.
- **Open-Meteo** (Tokyo forecast for the Briefing): data licensed CC BY 4.0 — https://open-meteo.com/ .
