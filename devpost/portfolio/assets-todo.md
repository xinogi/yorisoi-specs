# あとで撮る画像・GIF の一覧（README・Devpost・ポートフォリオ用）

置き場所はすべて `docs/images/`（まだフォルダは無い。最初の1枚を保存する時に作る）。
README は今 `docs/images/hero.png` を参照しているので、まずヒーロー画像を撮れば README の画像切れが直る。

**撮るのは、最終版のキャラクター動画が入ってから。** 今の仮キャラで撮ると、あとで全部撮り直しになる。

## 撮る物（必須の5つ）

| # | ファイル名 | 種類 | 何を写すか | 使う場所 |
|---|---|---|---|---|
| 1 | `docs/images/hero.png` | 静止画 1920x1080 | 机に向かう目線（少し下向き・約14°）で、机の作業の少し右・約2.5m先に彼女が全身で立っている。机の上に Call ボタン・外国語のページ・本が見えている | README の一番上、Devpost の表紙、ポートフォリオの1枚目 |
| 2 | `docs/images/cue-cards.gif` | GIF 5〜8秒 | カンペモードで、彼女の横に大きなカードが出る → Next をつまんで次のカードへ → 最後のカードで「You did great!」の字幕 | README「What it does」、ポートフォリオ |
| 3 | `docs/images/translation-card.png` | 静止画 | ページの単語（例: 檸檬 か 감사합니다）をつまんだ直後。単語のすぐ横に読み方と意味のカードが出て、彼女の吹き出しに日英の字幕が出ている | README、Devpost、ポートフォリオ |
| 4 | `docs/images/mode-switch.gif` | GIF 5〜8秒 | 彼女が近くにいる時に Mode を2〜3回つまむ → そのたびにモードの「呼んだ時」のセリフで返事が変わる | README「Customizing」、Devpost |
| 5 | `docs/images/leaf-panel.png` | 静止画 | LEAF のパネルで、各シナリオの結果（成功・失敗）が見えている画面 | README「LEAF tests」、デモ動画の 2:05〜2:20 |

## あると良い物（任意）

| ファイル名 | 種類 | 何を写すか |
|---|---|---|
| `docs/images/head-follow.gif` | GIF | 大きく横を向く → 彼女がゆっくり正面に戻ってくる（「いつも正面にいる」の証拠） |
| `docs/images/book-handoff.gif` | GIF | 本をつかんで彼女に差し出す → 本を開いて読み、要約の字幕が出る |
| `docs/images/call-button.gif` | GIF | Call ボタンをつまむ → 「What's up?」と言って約1.2m 手前まで歩いてくる |

## 撮り方

1. Lens Studio で `specs-lens.esproj` を開き、Preview を **Interactive Preview** にする。プレビューの大きさは 1920x1080。
2. 他のパネルは隠すか、あとで切り抜く。
3. 静止画は Preview の画面だけを切り抜いて PNG で保存する。GIF は OBS で録画してから GIF に変える（1本 5MB くらいまでを目安にすると README が重くならない）。
4. 操作は WASD で移動、Q/E で上下、右ドラッグで見回し、クリックがつまむ操作。撮る前に「座って机を見ている目線」の高さを Q/E で合わせる。

## 写してはいけない物（撮る前に確認）

- Windows のユーザー名が入ったファイルの場所（タイトルバーやパネルのパス表示）。切り抜きで外す。
- `.mcp.json` の中身や、Lens Studio の MCP の接続情報（トークン）。
- タスクバー・通知・他のアプリの窓。
- 実在の人の写真や、他社のロゴ・商標。

## 撮ったら

- README の `*Hero image: TBD.*` の行と、画像の上の `<!-- TODO ... -->` コメントを消す。
- GIF を README に足す時は、各節の下に `![説明](docs/images/ファイル名)` の形で入れる（説明は英語）。
- ポートフォリオ（ランサーズ・ココナラ・Fiverr）には、1〜3 の3枚を優先して使う。
