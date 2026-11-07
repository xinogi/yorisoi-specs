/**
 * DeskCompanionForeignPageUI — the stand-in foreign-language book page lying on the desk
 * (English, Korean and hard kanji) with highlighted words you can pinch, plus the translation
 * card that appears right next to the pinched word and fades after a few seconds.
 *
 * Owns: page layout (UIKit BackPlate + FlexLayout rows; every highlighted word is a UIKit Button
 * on a SceneObject named "Word_<id>"), the translation card view and its fade timer.
 * Public API (Channel A):
 *   onWordPinched: Event<string>   — word id, fired when a highlighted word is pinched
 *   showTranslation(wordId, word, reading, meaningJa, meaningEn)   (card: word -> reading ->
 *       English meaning, large -> Japanese meaning, small; tiny source label "translating…")
 *   setTranslationResult(wordId, meaningEn, meaningJa, source)    (live / offline update)
 *   hideTranslation()
 *   shownTranslationWordId         — "" when the card is hidden
 * Must not: decide what the answer is (DeskCompanionMain passes it in) or talk to the companion.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {PAGE_LINES, PAGE_WORDS, PageWord} from "./DeskCompanionContent"

// ── Typography: the single source of truth for text size + weight ────────────
// size = em-square @110cm (em-square cm = size / 43.886). Noto Sans JP/KR fill the em square a
// little more than the SnapOS system font, so FONT_SIZE_SCALE ≈ 0.695 / 0.733 ≈ 0.95.
const FONT_SIZE_SCALE = 0.95
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500}
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const FONT_JA = requireAsset("../Fonts/NotoSansJP-Medium.ttf") as Font
const FONT_KO = requireAsset("../Fonts/NotoSansKR-Medium.ttf") as Font
const ICON_BOOK = requireAsset("../Icons/menu_book.png") as Texture
const ICON_TRANSLATE = requireAsset("../Icons/g_translate.png") as Texture
const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

/** Viewing distance from the user's eyes to the page on the desk (cm) — drives text size. */
const VIEW_DISTANCE_CM = 80
const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08
const CARD_W = 17
const CARD_H = 8.2

@component
export class DeskCompanionForeignPageUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DeskCompanionForeignPageUI – stand-in foreign page + translation card</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(20, 50, 0.5))
  @hint("Page width (cm)")
  pageWidthCm: number = 34

  @input
  @widget(new SliderWidget(1.8, 4, 0.1))
  @hint("Height of each printed line (cm); highlighted words are slightly shorter")
  lineHeightCm: number = 2.7

  @input
  @widget(new SliderWidget(2, 20, 0.5))
  @hint("Seconds the translation card stays before fading")
  translationHoldSeconds: number = 8

  @input("vec4", "{1, 1, 1, 1}")
  @widget(new ColorWidget())
  @hint("Printed text color (keep light: the display is additive)")
  textColor: vec4

  @input("vec4", "{1, 0.95, 0.62, 1}")
  @widget(new ColorWidget())
  @hint("Text color on the highlighted (yellow) words — light, like a highlighter on the additive display")
  highlightTextColor: vec4

  @input
  @hint("Small caption at the top of the page so the stand-in is obvious")
  headerText: string = "Foreign book (stand-in) · 外国語の本"

  @input
  @hint("Hint at the bottom of the page")
  footerText: string = "Pinch a highlighted word · 光っている単語をつまんでね"
  @ui.group_end

  private panel: SceneObject
  private content: SceneObject
  private wordObjects: Record<string, SceneObject> = {}
  private card: SceneObject
  private cardWord: Text
  private cardReading: Text
  private cardJa: Text
  private cardEn: Text
  private cardSource: Text
  private _shownSource = ""
  private cardWant = false
  private cardInitialized = false
  private cardHideAt = -1
  private cardCancel: CancelFunction | null = null
  private _shownWordId = ""
  private _onWordPinched = new Event<string>()

  /** Fires with the word id when a highlighted word is pinched. */
  get onWordPinched(): PublicApi<string> {
    return this._onWordPinched.publicApi()
  }

  /** Id of the word whose translation card is showing, or "" when hidden. */
  public get shownTranslationWordId(): string {
    return this._shownWordId
  }

  /** The SceneObject of a highlighted word button (named "Word_<id>"). */
  public wordObject(id: string): SceneObject | null {
    return this.wordObjects[id] || null
  }

  onAwake(): void {
    this.panel = this.obj(this.getSceneObject(), "PagePanel")
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate

    this.content = this.obj(this.panel, "Content", new vec3(0, 0, 0.6))
    const flex = this.content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = this.pageWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.5
    flex.paddingTop = 1.4
    flex.paddingBottom = 1.4
    flex.paddingLeft = 1.6
    flex.paddingRight = 1.6
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const items: FlexItem[] = []
    items.push(this.addHeader(this.content))
    for (let i = 0; i < PAGE_LINES.length; i++) items.push(this.addLine(this.content, i))
    items.push(this.addFooter(this.content))
    flex.addItems(items)

    this.buildCard()

    this.createEvent("UpdateEvent").bind(() => {
      if (this.cardHideAt > 0 && getTime() >= this.cardHideAt) {
        this.cardHideAt = -1
        this.hideTranslation()
      }
    })
  }

  // ───────────────────────── Public API ─────────────────────────

  /** Show the translation card right next to (above) the pinched word. Replaces any previous card. */
  public showTranslation(wordId: string, word: string, reading: string, meaningJa: string, meaningEn: string): void {
    const wordSO = this.wordObjects[wordId]
    if (!this.card || !wordSO) return
    const w = PAGE_WORDS.filter((x) => x.id === wordId)[0]
    this.cardWord.font = w && w.script === "ko" ? FONT_KO : FONT_JA
    this.cardWord.text = word
    this.cardReading.text = reading
    this.cardJa.text = meaningJa
    this.cardEn.text = meaningEn
    this._shownSource = "translating…"
    if (this.cardSource) this.cardSource.text = this._shownSource

    // place the card above the word, inside the page width, lifted toward the viewer
    const inv = this.panel.getTransform().getInvertedWorldTransform()
    const local = inv.multiplyPoint(wordSO.getTransform().getWorldPosition())
    const half = this.pageWidthCm / 2 - CARD_W / 2 + 1
    const x = Math.max(-half, Math.min(half, local.x))
    this.card.getTransform().setLocalPosition(new vec3(x, local.y + this.lineHeightCm / 2 + CARD_H / 2 + 0.4, 2.0))

    this._shownWordId = wordId
    this.cardWant = true
    this.cardHideAt = getTime() + this.translationHoldSeconds
    if (this.cardInitialized) this.popCard(true)
  }

  /** Update the showing card with the live (or offline) translation for that word. */
  public setTranslationResult(wordId: string, meaningEn: string, meaningJa: string, source: string): void {
    if (wordId !== this._shownWordId) return // the card has moved on to another word
    if (this.cardEn) this.cardEn.text = meaningEn
    if (this.cardJa) this.cardJa.text = meaningJa
    this._shownSource = source
    if (this.cardSource) this.cardSource.text = source
  }

  /** Source label on the card: "translating…" | "live" | "offline" ("" when hidden). */
  public get shownTranslationSource(): string {
    return this._shownWordId ? this._shownSource : ""
  }

  /** Fade the translation card out. */
  public hideTranslation(): void {
    this._shownWordId = ""
    this.cardWant = false
    this.cardHideAt = -1
    if (this.cardInitialized) this.popCard(false)
  }

  // ───────────────────────── Builders ─────────────────────────

  private addHeader(parent: SceneObject): FlexItem {
    const row = this.obj(parent, "Header")
    this.liftInZ(row, LAYOUT_Z_LIFT)
    const f = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    f.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    f.direction = FlexDirection.Row
    f.justifyContent = FlexJustify.Start
    f.alignItems = FlexAlign.Center
    f.columnGap = 0.6
    f.width = -1
    f.height = 2.2
    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = 2.2
    item.alignSelf = FlexAlignSelf.Stretch
    item.marginBottom = 0.4

    const kids: FlexItem[] = []
    kids.push(this.addImage(row, ICON_BOOK, 1.8))
    const innerW = this.pageWidthCm - 3.2 - 2.4
    kids.push(this.addText(row, this.headerText, "Caption", innerW, 2.0, FONT_JA, new vec4(1, 1, 1, 0.7), HorizontalAlignment.Left))
    f.addItems(kids)
    return item
  }

  private addFooter(parent: SceneObject): FlexItem {
    const innerW = this.pageWidthCm - 3.2
    const so = this.obj(parent, "Footer")
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const t = this.makeText(so, this.footerText, "Caption", innerW, 2.0, FONT_JA, new vec4(1, 1, 1, 0.6), HorizontalAlignment.Center)
    t.horizontalOverflow = HorizontalOverflow.Shrink
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = 2.0
    item.alignSelf = FlexAlignSelf.Stretch
    item.marginTop = 0.4
    return item
  }

  private addLine(parent: SceneObject, index: number): FlexItem {
    const line = PAGE_LINES[index]
    const row = this.obj(parent, "Line" + (index + 1))
    this.liftInZ(row, LAYOUT_Z_LIFT)
    const f = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    f.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    f.direction = FlexDirection.Row
    f.justifyContent = FlexJustify.Start
    f.alignItems = FlexAlign.Center
    f.columnGap = 0.25
    f.width = -1
    f.height = this.lineHeightCm
    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = this.lineHeightCm
    item.alignSelf = FlexAlignSelf.Stretch

    const font = line.script === "ko" ? FONT_KO : FONT_JA
    const em = roleSize("Headline2", VIEW_DISTANCE_CM) / 43.886
    const kids: FlexItem[] = []
    for (const seg of line.segments) {
      if ("wordId" in seg) {
        const w = PAGE_WORDS.filter((x) => x.id === seg.wordId)[0]
        if (w) kids.push(this.addWordButton(row, w, font, em))
      } else {
        const width = this.estimateWidth(seg.text, em) + 0.2
        kids.push(this.addText(row, seg.text, "Headline2", width, this.lineHeightCm, font, this.textColor, HorizontalAlignment.Center, VIEW_DISTANCE_CM))
      }
    }
    f.addItems(kids)
    return item
  }

  private addWordButton(parent: SceneObject, w: PageWord, font: Font, em: number): FlexItem {
    const so = this.obj(parent, "Word_" + w.id)
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const width = this.estimateWidth(w.word, em) + 1.6
    const height = this.lineHeightCm - 0.35
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"}) // yellow = highlighter
    btn.size = new vec3(width, height, 1)
    const labelSO = this.obj(so, "Label", new vec3(0, 0, BUTTON_LABEL_Z))
    this.makeText(labelSO, w.word, "Headline2", width - 0.4, height, font, this.highlightTextColor, HorizontalAlignment.Center, VIEW_DISTANCE_CM)
    btn.onTriggerUp.add(() => this._onWordPinched.invoke(w.id))
    this.wordObjects[w.id] = so
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    return item
  }

  private buildCard(): void {
    // Created AFTER Content so the Canvas hierarchy draws it on top of the page.
    this.card = this.obj(this.panel, "TranslationCard", new vec3(0, 0, 2.0))
    const plate = this.card.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    plate.size = new vec2(CARD_W, CARD_H)

    const content = this.obj(this.card, "CardContent", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    flex.width = CARD_W
    flex.height = CARD_H
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.2
    flex.paddingLeft = 1.0
    flex.paddingRight = 1.0
    flex.paddingTop = 0.6
    flex.paddingBottom = 0.6
    const innerW = CARD_W - 2.0

    const items: FlexItem[] = []
    // Row 1: translate icon + word + reading
    const top = this.obj(content, "WordRow")
    this.liftInZ(top, LAYOUT_Z_LIFT)
    const tf = top.createComponent(FlexLayout.getTypeName()) as FlexLayout
    tf.autoDiscoverItemsOnStart = false // children are registered explicitly via addItems
    tf.direction = FlexDirection.Row
    tf.justifyContent = FlexJustify.Start
    tf.alignItems = FlexAlign.Center
    tf.columnGap = 0.5
    tf.width = -1
    tf.height = 2.6
    const topItem = top.createComponent(FlexItem.getTypeName()) as FlexItem
    topItem.overrideHeight = 2.6
    topItem.alignSelf = FlexAlignSelf.Stretch
    const topKids: FlexItem[] = []
    topKids.push(this.addImage(top, ICON_TRANSLATE, 1.7))
    const wordItem = this.addText(top, "", "Headline1", 6.0, 2.6, FONT_JA, new vec4(1, 0.93, 0.55, 1), HorizontalAlignment.Left, VIEW_DISTANCE_CM)
    this.cardWord = wordItem.getSceneObject().getComponent("Component.Text") as Text
    topKids.push(wordItem)
    const readingItem = this.addText(top, "", "Body", innerW - 6.0 - 1.7 - 1.0 - 3.2, 2.6, FONT_JA, new vec4(1, 1, 1, 0.85), HorizontalAlignment.Left, VIEW_DISTANCE_CM)
    this.cardReading = readingItem.getSceneObject().getComponent("Component.Text") as Text
    this.cardReading.horizontalOverflow = HorizontalOverflow.Shrink
    topKids.push(readingItem)
    const sourceItem = this.addText(top, "", "Caption", 3.2, 2.6, FONT_JA, new vec4(1, 0.9, 0.5, 0.9), HorizontalAlignment.Right, VIEW_DISTANCE_CM)
    this.cardSource = sourceItem.getSceneObject().getComponent("Component.Text") as Text
    this.cardSource.horizontalOverflow = HorizontalOverflow.Shrink
    topKids.push(sourceItem)
    tf.addItems(topKids)
    items.push(topItem)

    // English meaning first and large, Japanese meaning small below (English-first for the judges)
    const enItem = this.addText(content, "", "Body", innerW, 2.0, FONT_JA, new vec4(1, 1, 1, 1), HorizontalAlignment.Left, VIEW_DISTANCE_CM)
    enItem.alignSelf = FlexAlignSelf.Stretch
    this.cardEn = enItem.getSceneObject().getComponent("Component.Text") as Text
    this.cardEn.horizontalOverflow = HorizontalOverflow.Shrink
    items.push(enItem)
    const jaItem = this.addText(content, "", "Caption", innerW, 2.0, FONT_JA, new vec4(0.8, 0.9, 1, 0.95), HorizontalAlignment.Left, VIEW_DISTANCE_CM)
    jaItem.alignSelf = FlexAlignSelf.Stretch
    this.cardJa = jaItem.getSceneObject().getComponent("Component.Text") as Text
    this.cardJa.horizontalOverflow = HorizontalOverflow.Shrink
    items.push(jaItem)
    flex.addItems(items)

    // Start hidden: disable only once the card's BackPlate has initialized (tail of its init).
    plate.onInitialized.add(() => {
      this.cardInitialized = true
      if (this.cardWant) this.popCard(true)
      else this.card.enabled = false
    })
  }

  private popCard(show: boolean): void {
    if (this.cardCancel) this.cardCancel()
    const tr = this.card.getTransform()
    if (show) {
      this.card.enabled = true
      tr.setLocalScale(new vec3(0.85, 0.85, 0.85))
      this.cardCancel = animate({
        duration: 0.18,
        easing: "ease-out-back",
        update: (t: number) => {
          const s = 0.85 + 0.15 * t
          tr.setLocalScale(new vec3(s, s, s))
        }
      })
    } else {
      if (!this.card.enabled) return
      this.cardCancel = animate({
        duration: 0.25,
        easing: "ease-in-out-quad",
        update: (t: number) => {
          const s = 1 - 0.3 * t
          tr.setLocalScale(new vec3(s, s, s))
        },
        ended: () => {
          if (!this.cardWant) this.card.enabled = false
          tr.setLocalScale(vec3.one())
        }
      })
    }
  }

  // ───────────────────────── Helpers ─────────────────────────

  /** Rough rendered width of `text` at em size `em` (cm): CJK/Hangul ≈ 1 em, Latin ≈ 0.55 em. */
  private estimateWidth(text: string, em: number): number {
    let w = 0
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (c >= 0x2e80) w += 1.0
      else if (c === 32) w += 0.27
      else if (c >= 65 && c <= 90) w += 0.66
      else if (c >= 48 && c <= 57) w += 0.56
      else if (".,!?'’:;".indexOf(text.charAt(i)) >= 0) w += 0.3
      else w += 0.54
    }
    return w * em
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private liftInZ(so: SceneObject, z: number): void {
    const t = so.getTransform()
    const p = t.getLocalPosition()
    t.setLocalPosition(new vec3(p.x, p.y, p.z + z))
  }

  private makeText(so: SceneObject, text: string, role: TextRole, widthCm: number, heightCm: number, font: Font,
    color: vec4, align: HorizontalAlignment, distanceCm: number = VIEW_DISTANCE_CM): Text {
    const t = so.createComponent("Component.Text") as Text
    t.font = font
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, distanceCm)
    t.textFill.color = color
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    return t
  }

  private addText(parent: SceneObject, text: string, role: TextRole, widthCm: number, heightCm: number, font: Font,
    color: vec4, align: HorizontalAlignment, distanceCm: number = VIEW_DISTANCE_CM): FlexItem {
    const so = this.obj(parent, "Text")
    this.liftInZ(so, LAYOUT_Z_LIFT)
    this.makeText(so, text, role, widthCm, heightCm, font, color, align, distanceCm)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    return item
  }

  private addImage(parent: SceneObject, texture: Texture, sizeCm: number): FlexItem {
    const so = this.obj(parent, "Icon")
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const img = so.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = texture
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = sizeCm
    item.overrideHeight = sizeCm
    return item
  }
}
