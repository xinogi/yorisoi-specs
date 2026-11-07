"""Convert persona/modes.md (human-editable) into a TypeScript data module for the Lens.

Usage:
    python tools/build_persona.py            # writes Assets/Scripts/DeskCompanionPersonaData.ts
    python tools/build_persona.py --out PATH # write somewhere else (e.g. for review)

The Markdown format is described at the top of persona/modes.md. Each mode:
    ## モード: <日本語名>（<English name>）
    **性格（AI への指示）**   -> paragraph(s)        -> systemPrompt
    **動き**                  -> bullets             -> teaseSeconds / wander / favoriteAnims
    **カンペの中身...**       -> numbered list       -> cueCards (optional)
    **セリフ**                -> "- label: "EN" ／ 「JA」" bullets -> lines
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "persona", "modes.md")
DEFAULT_OUT = os.path.join(ROOT, "Assets", "Scripts", "DeskCompanionPersonaData.ts")

LINE_KEYS = {
    "呼んだ時": "call",
    "ちょっかい1": "tease_1",
    "ちょっかい2": "tease_2",
    "ちょっかい3": "tease_3",
    "離れる時": "leave",
    "次のカードの時": "cue_next",
    "最後のカードの時": "cue_done",
    "時間が押した時": "cue_slow_down",
    "残り1分の時": "cue_one_minute",
    "リハーサルの終わり": "cue_rehearsal_done",
}
WANDER = {"小": "small", "中": "medium", "大": "large"}
ANIMS = {"idle", "walk", "talk", "wave", "lean_in", "read", "dance", "pose"}


def slug(name_en):
    return re.sub(r"[^a-z0-9]+", "_", name_en.lower()).strip("_")


def parse(md):
    modes = []
    blocks = re.split(r"^## モード:\s*", md, flags=re.M)[1:]
    for block in blocks:
        header, _, body = block.partition("\n")
        m = re.match(r"(.+?)（(.+?)）", header.strip())
        if not m:
            raise ValueError(f"mode header needs 日本語名（English）: {header!r}")
        name_ja, name_en = m.group(1).strip(), m.group(2).strip()
        body = body.split("\n---")[0]
        sections = re.split(r"^\*\*(.+?)\*\*[^\n]*$", body, flags=re.M)
        sec = {sections[i].strip(): sections[i + 1] for i in range(1, len(sections) - 1, 2)}

        mode = {"id": slug(name_en), "nameJa": name_ja, "nameEn": name_en,
                "isDefault": "最初はこのモード" in header,
                "systemPrompt": "", "teaseSeconds": 20, "wander": "medium",
                "favoriteAnims": ["idle"], "lines": {}, "cueCards": []}
        for title, text in sec.items():
            if title.startswith("性格"):
                mode["systemPrompt"] = " ".join(l.strip() for l in text.strip().splitlines() if l.strip())
            elif title.startswith("動き"):
                for l in text.splitlines():
                    l = l.strip().lstrip("-").strip()
                    if l.startswith("ちょっかいまでの秒数"):
                        mode["teaseSeconds"] = float(re.search(r"[\d.]+", l).group())
                    elif l.startswith("うろうろの大きさ"):
                        v = l.split(":", 1)[1].strip()[:1]
                        mode["wander"] = WANDER.get(v, "medium")
                    elif l.startswith("よく使う動き"):
                        anims = [a.strip() for a in l.split(":", 1)[1].split(",")]
                        bad = [a for a in anims if a not in ANIMS]
                        if bad:
                            raise ValueError(f"{name_en}: unknown anims {bad}")
                        mode["favoriteAnims"] = anims
            elif title.startswith("カンペの中身"):
                # One deck per "**カンペの中身: <deck name>**" section; numbered lines are cards,
                # indented "- " lines under a card are its detail notes (shown when that card is current).
                deck_name = re.sub(r"^カンペの中身[:：]?\s*", "", title).strip() or "Deck"
                cards = []
                for l in text.splitlines():
                    if re.match(r"^\s*\d+\.", l):
                        body = re.sub(r"^\s*\d+\.\s*", "", l.strip())
                        secs = 0
                        ms = re.match(r"^\[(\d+)\s*秒\]\s*", body)
                        if ms:
                            secs = int(ms.group(1)); body = body[ms.end():]
                        note = ""
                        if "｜" in body:
                            body, _, rest = body.partition("｜")
                            note = re.sub(r"^\s*話し方[:：]\s*", "", rest.strip())
                        cards.append({"text": body.strip(), "note": note, "seconds": secs, "details": []})
                    elif cards and re.match(r"^\s{2,}[-*]\s+", l):
                        cards[-1]["details"].append(re.sub(r"^\s*[-*]\s+", "", l).strip())
                mode.setdefault("cueDecks", []).append({"name": deck_name, "cards": cards})
                if not mode["cueCards"]:
                    mode["cueCards"] = cards
            elif title.startswith("セリフ"):
                for l in text.splitlines():
                    mm = re.match(r'^\s*-\s*(.+?):\s*"(.+?)"\s*／\s*「(.+?)」\s*$', l)
                    if mm:
                        key = LINE_KEYS.get(mm.group(1).strip())
                        if key:
                            mode["lines"][key] = {"en": mm.group(2), "ja": mm.group(3)}
        missing = [k for k in ("call", "leave") if k not in mode["lines"]]
        if missing:
            raise ValueError(f"{name_en}: missing lines {missing}")
        modes.append(mode)
    if not modes:
        raise ValueError("no modes found")
    if not any(m["isDefault"] for m in modes):
        modes[0]["isDefault"] = True
    return modes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    with open(SRC, encoding="utf-8") as f:
        modes = parse(f.read())
    ts = ("// GENERATED by tools/build_persona.py from persona/modes.md. Do not edit by hand;\n"
          "// edit persona/modes.md and re-run the script.\n\n"
          "/** One talk-list item: what to say, how to say it (話し方), and its target seconds (0 = no target). */\n"
          "export interface CueCard { text: string; note: string; seconds: number; details: string[]; }\n"
          "export interface CueDeck { name: string; cards: CueCard[]; }\n"
          "export interface PersonaLine { en: string; ja: string; }\n"
          "export interface PersonaMode {\n  id: string; nameJa: string; nameEn: string; isDefault: boolean;\n"
          "  systemPrompt: string; teaseSeconds: number; wander: \"small\" | \"medium\" | \"large\";\n"
          "  favoriteAnims: string[]; lines: { [key: string]: PersonaLine }; cueCards: CueCard[]; cueDecks?: CueDeck[];\n}\n\n"
          "export const PERSONA_MODES: PersonaMode[] = " + json.dumps(modes, ensure_ascii=False, indent=2) + ";\n")
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(ts)
    print(f"wrote {args.out}: {len(modes)} modes -> " + ", ".join(m["id"] + ("*" if m["isDefault"] else "") for m in modes))


if __name__ == "__main__":
    sys.exit(main())
