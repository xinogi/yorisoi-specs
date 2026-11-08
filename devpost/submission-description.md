# Devpost submission text: Yorisoi

<!--
Notes before pasting (do not paste this block)
- Paste each "##" section into the matching Devpost field. "Name" and "Tagline" go in the top fields.
- Briefing, Timer, Music and Look up are all in the final build (buttons: Briefing, Timer, Music, Look up).
- The room in the video is the "Sunlit Room" preview scene, not part of the Lens on glasses.
- LEAF: DC1-DC10 all pass in the preview (2026-11-08).
- Still to fill before pasting: the YouTube URL, and confirm the repo is public.
-->

## Name

Yorisoi (寄り添い, "staying close beside someone")

## Tagline

Your girlfriend and a super-capable secretary, in your real space. An AR companion for SPECS who holds cue cards only you can see and really translates what you can't read.

## Inspiration

An AI partner on a phone, a laptop or in VR always feels a little fake: everything around her is made up, so part of you keeps thinking "this isn't real." On glasses, she can stand in your actual room, next to your actual desk, and look at the same page you are looking at.

We also wanted her to be useful, not only cute. The learner picked two everyday problems:

- **Presenting.** You want your notes, but you don't want the audience to see you reading them.
- **Reading another language.** You hit a word you can't read, and stopping to type it into a phone breaks your flow.

Glasses are good at both: a display that only the wearer can see, and an answer that can appear right on the thing you are looking at. So the idea became one character with two sides: **your girlfriend and a super-capable secretary, in your real space.**

## What it does

You sit at your desk and work. **Yori** stands in your room, a little to the right of your work so she never covers it, and quietly does her own thing. She doesn't talk unless you call her. When you do, she is warm, a bit playful, and very good at her job.

### Hero feature 1: cue cards only you can see

- Switch her to **Cue cards** and your whole **talk list** appears beside her and **stays visible the entire time**. Yori steps aside so the list has room.
- The current item is big and bright, with your **delivery note** under it ("pause here, smile"), extra details, and a **time bar** that goes green, yellow, red. A total timer sits in the header.
- **Auto** moves through the list by itself on each item's planned time. Or move it yourself with **Next** / **Back**.
- **Rehearse** runs the deck from the top and tells you your total time at the end.
- Adjust it live: **+5s / −5s** on the current item, move an item **up or down**, pinch any row to **jump** to it, **Deck ▶** to switch talks, **A− / A+** for text size.
- She **coaches you quietly**: if an item runs well over its time she whispers *"Slow down a little. You've got this."* She warns you at one minute left, and on the last item she says *"You did great!"*
- **Only the wearer sees the cards.** The audience just sees you, looking up. Notes on a laptop or phone pull your eyes down; these stay in front of you.

### Hero feature 2: real translation, right on the page

- A foreign-language page lies on your desk (English, Korean and hard kanji). **Pinch a highlighted word** and the translation appears **right next to that word**, not on a floating panel, then fades after about 8 seconds.
- This is **live translation** from the free [MyMemory](https://mymemory.translated.net/) API (no key, no account). English goes to Japanese, Korean to English and Japanese, Japanese to English.
- **Translate…** lets you type anything and get it in the other two languages. On glasses you use the SPECS AR keyboard. In Lens Studio's preview the keyboard doesn't appear, so a short phrase labeled "demo text" is used instead.
- If the network fails or takes more than about 3 seconds, the card falls back to a built-in answer and says **offline**. Otherwise it says **live**.
- Privacy: only the text you choose to translate is sent. No camera image, audio, account or location goes with it.

### The secretary side

- **Briefing:** pinch **Briefing** and she runs through **today's real weather for a demo city, Tokyo** (live from [Open-Meteo](https://open-meteo.com/), free, no key; the Lens never reads your location) and your schedule (**sample data**), then asks *"Want to rehearse?"*
- **Timers and reminders:** pinch **Timer** to pick a preset (1 min, 5 min rehearsal, a stretch reminder, a talk reminder) and a countdown appears beside her; when it ends she tells you in her own words. They last for the current session only.
- **Stretch break:** pinch **Stretch** and she leads a 1 to 2 minute desk-break routine: arms up, side lean, shoulder rolls, neck tilt, with the move name, a 1-2-3-4 count and a timer beside her. It ends with *"Great job! Feel better?"* (She leads and you follow. The preview can't track your body.)
- **Look up:** pinch **Look up** and she brings a short summary of a topic from **Wikipedia** (live, with the source line on the card; offline fallback).
- **Ask:** everyday questions like tomorrow's weather, today's plan or a project tip. These answers are **sample data** and the card says so.

### The girlfriend side

- **Always in front of you, never behind you.** If you turn away and she ends up more than about 12° off her spot, she glides back into view within about 1.4 seconds. This came straight from the learner's design note: *"If I'm working at my desk, I want her always in front of my view. I don't want her behind me."*
- **Quiet by default.** The **Chat** toggle starts off, so she never talks unprompted. Pinch **Call** and she says *"Hey, what's up?"* and walks up to about 1.2 m in front of you. If you turn Chat on, she checks in now and then, never repeats the same line twice in a row, and waits twice as long if you don't answer.
- **Music together:** pinch **Music** to put on one of three original tracks made for this project (Focus, Relax, Calm); she sways along, and the music dips whenever she speaks.
- **My song:** the next step of **Music** plays *your* song from a link to an audio file you own (typed on the AR keyboard, remembered for next time). The Lens ships no third-party music. When a timer or reminder ends, your song also plays as a gentle alarm. In the preview it uses a CC0 recording of Satie's *Gymnopédie No. 1* from Wikimedia Commons, labeled "demo link".
- **Poke her** and she reacts: a tickle, then a pout if you keep going (*"Okay, that's enough. Hands off!"*), then she forgives you. There is no reaction tied to specific body parts.
- **Hand her a book** (*Alice's Adventures in Wonderland*, public domain) and she reads it and gives you a short summary. **Dance** and **Pose** buttons appear when she is close. Cute and fun, never sexual.

### Comfort and control

- **Voice only:** some people don't want a person in view while they work. One toggle hides her body; a small soft light dot stays where she stands, and every feature still works from the same place.
- **Voice volume** slider and **Mute**. Her voice is English, with **English subtitles (big) and Japanese subtitles (small)** in a bubble beside her head, and it is spatial audio, so you hear where she stands.
- **Six personality modes**: Sweetheart (default), Smart, Secretary, Cue cards, Dance, Healing. Each changes her lines, how much she moves, how often she checks in and which clips she favors. All of it lives in **one editable Markdown file** (`persona/modes.md`), including your own cue-card decks.
- **Grounded in the room:** she never walks through the desk, and the desk hides the part of her that is behind it.

### What is live and what is sample data

| Part | In this build |
|---|---|
| Word and text translation | **Live** (MyMemory API), offline fallback labeled "offline" |
| Weather in the Briefing | **Live** (Open-Meteo) |
| Look up summaries | **Live** (Wikipedia), offline fallback labeled "offline" |
| My song | **Live** download from your link (CC0 demo link in the preview) |
| Schedule, Ask answers | **Sample data**, labeled on the card |
| Timers, reminders, cue-card timing | Real timers, current session only |
| Her spoken lines | Pre-recorded English voice lines (AI text-to-speech), not a live AI |
| Talking to her | In the preview you pinch **Call**. Voice input on the device is future work |
| The room in the video | The "Sunlit Room" preview scene. On glasses, she stands in your real room |

### What's new about it

We compared ten current glasses and XR products (Snap Spectacles and SPECS, Meta Ray-Ban Display and Meta's AI glasses, Even Realities, XREAL, Rokid, Brilliant Labs, Android XR glasses, Apple Vision Pro) mostly from their official pages. Most offer a voice assistant, translation, notifications and music. In the sources we checked, we found a teleprompter only on Even Realities and Rokid, and **no assistant with a body or a character** on any of them. AI companion apps and devices do exist (Replika, Gatebox), but they live on a screen or inside a small desktop device. Yorisoi puts the assistant into a person who stands in your real room, waits until you call, and works on the page and the talk in front of you.

## How we built it

We followed the hackathon's full agent workflow: **plan-lens → approved brief → CLAD through the Lens Studio MCP → LEAF tests**, with design notes (not code) going back to the agent after each round.

1. **Plan with plan-lens.** The plan-lens skill pack interviewed the learner (in Japanese), checked each answer against AR design habits and against what Lens Studio's preview can do, and wrote `devpost/design-brief.md`: where everything lives in centimeters, what stands in for sensing the preview can't do, and six done criteria. The learner made every decision, and the brief was approved before any building started. Later decisions (her name, quiet-by-default, the cue-card talk list, Voice only, the stretch break) were written back into the brief first.
2. **Build with CLAD through the Lens Studio MCP.** CLAD, Snap's Lens Studio agent toolkit, read the brief and built the scene, the Spectacles Interaction Kit and UI Kit interactions, and the TypeScript behavior in Lens Studio 5.24.1, working through the Lens Studio MCP server. Each script has one job (`DeskCompanion*.ts`: controller, animator, voice, cue cards, translator, stretch and so on), and every interactive object has a stable name so tests can find it.
3. **Test with LEAF.** One LEAF scenario per done criterion, run in the Lens Studio preview. The scenarios pinch the real buttons through a test interactor and check her position, her lines and the UI. Long timers are sped up during tests and put back afterwards.
4. **Iterate with design notes.** For example (translated from Japanese): *"Stop talking to me all the time. When I call you, 'what's up?' is enough."* That note made Chat off by default, with a backoff when you don't answer.

**Making a photoreal person work on an additive display.** SPECS uses an additive display, where black renders as transparent. Yori is a photoreal video character: short AI-generated video clips of an original, fictional woman filmed on pure black, played on a card that always turns to face you, with additive blending. The black disappears and only she remains in the room. Her clothes, the text and the UI are kept light so they stay visible, and the card is brightened slightly so she reads more solid.

**Her personality is a file.** `persona/modes.md` holds every mode's lines (English and Japanese), behavior numbers, cue-card decks, and a personality prompt per mode for a future live AI. `tools/build_persona.py` turns it into the Lens data.

**About Yori.** Yori is the author's personal character. She appears in the demo video, but her images and clips are not in the public repo. The repo ships placeholder clips and a swappable character system (one folder per character), so anyone can build their own companion.

### LEAF results (Lens Studio preview)

| # | What it checks | Result |
|---|---|---|
| DC1 | At start she is about 2.5 m in front, slightly right, whole body in view at the desk gaze; turning away makes her glide back into view within 2 s | Pass |
| DC2 | Quiet by default. With Chat on she comes closer and checks in, never repeats a line twice in a row, and waits twice as long when ignored | Pass |
| DC3 | Call makes her say "Hey, what's up?" and walk to about 1.2 m; voice slider and Mute work; Voice only hides her body while Call still answers | Pass |
| DC4 | Pinching a highlighted word shows the translation right next to it, then it fades | Pass |
| DC5 | Handing her the book makes her read it and give a short summary | Pass |
| DC6 | Mode cycling, and the full cue-card talk list: highlight, time bar, Next / Back, coaching, Auto, Rehearse, deck switch, ±5s, reorder, jump | Pass |
| DC7 | Poking her: tickle, then annoyed, then she forgives you; Call still works right after | Pass |
| DC8 | Ask answers with the "sample data" label; translation returns a result (live or offline); Translate… works with the demo phrase | Pass |
| DC9 | Stretch break: four moves in order with count and card, then "Great job! Feel better?"; another button cancels it | Pass |
| DC10 | Briefing card with live Tokyo weather; Timer presets count down and fire the reminder, and My song plays as the alarm; Music plays Focus / Relax / Calm / My song (downloaded from its link), ducks under her voice and stops; Look up shows a Wikipedia summary with its source | Pass |

Not covered by any test: anything only real glasses can tell (comfort over a long session, real hand tracking, real speech recognition, real furniture hiding her).

## Challenges we ran into

- **The MCP connection looked dead, but it wasn't.** Lens Studio's MCP server was running, yet every reply failed in the agent's HTTP client. A local antivirus web shield was rewriting loopback HTTP responses: it declared chunked transfer encoding without chunk framing and kept the connection open. We proved it by sending a correct response from our own test server and getting the same corruption back. The fix was a small **stdio bridge** (`tools/ls_mcp_bridge.py`): the agent talks to it over stdio, and it forwards each JSON-RPC message to Lens Studio over a raw socket and reads the reply tolerantly. It reads the session token from the project's `.mcp.json` on every request (Lens Studio rewrites that file at each start), stores nothing secret and logs nothing. The agent still works **only through the MCP tools**; the bridge fixes the transport and bypasses nothing.
- **No MCP tools until the AI plugins were trusted.** The Lens Studio AI plugins (LEAF and others) download after the first launch and only load after a restart and a permission prompt for each one.
- **Lens Studio hung or crashed twice mid-build.** The scene had been built from VirtualScene definitions saved as files, so re-applying them brought the scene back instead of rebuilding it by hand.
- **A believable person on a see-through display.** Dark areas (hair, eyes, shadows) render see-through, so a photoreal person looks partly translucent. We chose a light outfit, light UI and a slight brightness boost. It can't make dark parts fully solid, and we say so.
- **Sensing the preview can't do.** The preview has no camera reading, no voice input and no AR keyboard. Every stand-in is visible and labeled: pinch a word instead of pointing a camera at it, pinch **Call** instead of speaking, and a "demo text" phrase instead of typing.
- **Making a companion that isn't annoying.** The first version came over and teased you on its own after about 20 seconds of quiet. The learner's verdict was clear: too much. Quiet-by-default, with Call as the main way in, made her feel like company instead of a notification.

## Accomplishments that we're proud of

- **A complete experience, not a feature demo.** The video follows one working session: call her, get a briefing, rehearse a talk with cue cards, translate a word, take a stretch break, wind down with music.
- **Two practical features that are real:** private cue cards with timing and coaching, and live translation that lands on the page.
- **Ten LEAF scenarios passing in the preview** (DC1–DC10): every done criterion in the brief, plus poke reactions, Ask, typed translation, the stretch break and the secretary features.
- **Honest labels everywhere:** live, offline, sample data and demo text are shown on the cards themselves.
- **A personality anyone can edit:** six modes and your own cue-card decks in one Markdown file, no code needed.
- **A non-engineer-directed build:** the learner made the design decisions; the agents built and tested them.

## What we learned

- **On narrow-view glasses, keep the companion in front.** Letting her wander around the room meant losing her. A lazy head-follow that brings her back within about a second and a half feels calm and keeps her findable.
- **Put the answer on the thing it's about.** A translation next to the word beats a panel floating somewhere else.
- **Company is not chatter.** Waiting to be called made her feel more like a person who respects your focus.
- **The private display is a real advantage.** Cue cards that only the wearer can see, without looking down at a laptop or phone, are a strength only glasses have.
- **Planning first pays off with agents.** Because the brief already said where everything goes and what "done" means, the first CLAD build had the whole basic flow, and later rounds were short design notes.
- **Label what you know.** "Logic proven" in the preview is not "feels right on glasses." We kept the two apart.

## What's next

- **Real voice input on the device**, so you talk to her instead of pinching Call (SPECS speech recognition).
- **A live AI behind her answers**, using the personality prompts already written for each mode.
- **Camera on the real glasses**: point at a page or sign and Yori reads and translates it for you; she can turn a photo or a whiteboard into text (OCR) and transcribe what was said.
- **Memories together**: look back through your captures with her ("this one's great, let's make it our special shot") and keep the best moments.
- **Memory**, so she remembers your work and your day with you over time.
- **Walking directions at night**: Yori walks a step ahead and points the way home ("this way"), using SPECS location and a maps service.
- **Yoga and fitness lessons**, built on the same routine system as the stretch break.
- **A physical AI body** someday, so the same companion can help in the real world.
- And first of all: **testing on a real SPECS device** for comfort, hand tracking and how it feels to have her in front of you for a whole work session.

## Built with

Lens Studio 5.24.1, Snap SPECS, CLAD, Lens Studio MCP, LEAF, Spectacles Interaction Kit, Spectacles UI Kit, TypeScript, Python, Claude Code, plan-lens skill pack, MyMemory Translation API, Open-Meteo API, AI text-to-speech (voice lines), AI video generation (character clips)

## Links

- Demo video: [TBD: public YouTube URL, under 3 minutes]
- Repo: [TBD: confirm public] https://github.com/xinogi/yorisoi-specs

Built by **Xinogi Studio (しのぎ)**.
