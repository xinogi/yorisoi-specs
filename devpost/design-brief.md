---
status: approved
---

# Design brief: Yorisoi — an AR companion who shares your space

<!-- Filled in by plan-lens from the learner's interview (interview held in Japanese; quotes translated). Values the learner didn't choose are marked (default). -->

## The one spatial moment
I'm working at my desk, looking straight ahead. My companion is always in front of me, a little to the side of my work, doing her own thing; she never goes behind me or out of view. After a while she comes over and teases me a little: "What are you doing? Anything I can do?" When I call her, she says "What's up?" and walks up in front of me. I point at a word I can't read in a foreign book on my desk, she tells me what it says, and the answer appears right next to the word.

## Why it belongs on glasses
- Uses: draws in the world (she is in my real room, next to my real desk); shares your view (she talks about what I'm looking at); leaves your body free (I keep working with my hands and eyes on my task).
- Why it's better than the phone or laptop version: In VR or on a screen everything is fake, so I just think "this isn't real." With AR she is inside my real room and real day, so it feels like she is actually with me, and I stay facing the real world while I use AI.

## Product or overlay
- Type: product (the companion is the experience), with an overlay moment (she helps with real text I'm looking at).
- What the real version would sense: what I'm looking at (camera: text in a book, an object), my voice, and how long I've been working without talking to her.
- Stand-in for the preview:
  - A virtual foreign-language book/page on the desk (English, Korean and hard kanji) with a few highlighted words. Pinching a word = "I asked her about this word." Her answer is hard-coded.
  - A big "Call" button on the desk = "I spoke to her." (Voice may not work in the preview.)
  - A virtual book I can grab and hand to her = "I gave her a real book to read." Her reaction and summary are hard-coded.
  - A real AI (ChatGPT etc.) behind her answers is optional; the demo never depends on it.

## Where things live
- Where the user is looking during the main task: straight ahead at the desk and the work on it, seated (default).
- Desk: a virtual desk at real size, 72 cm high, 120 x 60 cm, in front of the user (default; the preview has no real desk).
- Companion: an original 3D character who is stunningly beautiful (learner: "a super-beautiful 3D girl; I won't compromise on that"), clearly an adult, realistic like a real photo (learner: not anime-style). Learner's image (updated 2026-11-08): an international, Western-style super-beautiful woman (the judges are likely English-speaking), "cuter than any supermodel," with a curvy hourglass figure shown through fitted but modest clothes. Chosen face (2026-11-08): candidate_5, a Western European woman with long light-brown waves in a light-ivory knit midi dress (avatar-work/stills/candidate_5.png, outside the repo until approved). Personality: super sweet, kind, attentive, thoughtful, and forgiving of everything — this sets the tone of all her lines. Outfit: a fitted but modest light-ivory knit midi dress (from the chosen still; light colors also show better on the additive display). Hair: long light-brown waves. Life-size, about 165 cm tall (learner: "at least 160 cm, ideally about 165"). How she is made (learner's decision 2026-11-08, after comparing a true-3D game-quality model with a photoreal option): a photoreal "video character" — short video clips of an original AI-generated woman (Z-Image-Turbo still → Wan2.2 image-to-video, both Apache-2.0, generated locally) on a pure black background, played on a card that always turns to face the user, with additive blending so black disappears on SPECS. Clips: idle, walk, wave, talk, lean in/tease, read a book, dance/pose. Realism comes first; from the side she is flat, which is acceptable because the user sits facing her. She always stays in front of the user, inside the glasses' narrow view (about 37° tall x 32° wide), never behind or beside the shoulder. Learner (2026-11-08): "If I'm working at my desk, I want her always in front of my view. I don't want her behind me." She lazily follows the head: if she drifts out of the center of view (more than about 12° off), she glides back to the front within about 1 to 2 s (default). Resting spot: about 2.5 m away, 8° to the right of the desk work so she never covers it (default); her whole body fits in view at the natural desk-working gaze (about 14° down). Looking perfectly level, her lower legs leave the narrow view; that is accepted. Inside that front zone she moves a little, changes poses, turns, and does her own idle actions. When called she walks up and stops about 1.2 m in front, so her face and upper body are in view (default).
- Call button: big and easy to press, on the front-right of the desk within reach, about 8 cm across (default). Learner: "anywhere easy to touch is fine."
- Foreign-language page: lying on the desk about 40 to 50 cm in front, slightly below eye level (default).
- Book to hand over: on the left side of the desk (default).
- Her subtitles: a speech bubble right beside her head, short lines, light text readable from the desk (default).
- Translation answer: right next to the word that was pinched (default).

## Hands and input
- Call her: pinch the big Call button. She says "What's up?" (voice + subtitle) and comes over.
- Ask about text: pinch a highlighted word on the page. She explains the reading/meaning; the answer appears next to the word.
- Give her a book: grab the book on the desk and drop it into her hands (or near her). She opens it, reads, and says a short summary.
- Ask for a dance or pose: pinch a button that appears near her after she comes over (default). She dances or strikes a pose (cute, fun, not sexual).
- Switch her mode: pinch a "Mode" button in the same row (after she comes over). Modes (learner, 2026-11-08): Sweetheart (default), Smart, Secretary, Cue cards, Dance, Healing. Each mode changes her lines, how often she comes over, how much she moves, and which clips she favors. All modes are defined in one editable Markdown file, persona/modes.md, which is converted to the Lens data; it also holds a personality prompt per mode for a future live AI.
- Cue cards (practical help, learner's request): in Cue cards mode she shows your talking points as big light cards right beside her; pinch "Next" / "Back" to move through them; on the last card she says "You did great!".
- Translation stays available in every mode (the most practically useful help).
- She only helps with words, cards, dancing and company. Physical help (fetching food or drinks) is future work for a robot body.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: talking to her uses SPECS speech recognition on real glasses (feel unproven); the Call button does the same job in the preview.

## When things show
- Companion: always in front of the user and in view, doing her own thing; comes close only when called or when she decides to tease.
- Teasing: after about 20 seconds with no interaction (default), she walks closer and says "What are you working on? Anything I can help with?" (words only; she has no body, so no fetching food or drinks)
- Subtitles: show while she speaks, fade about 3 seconds after (default).
- Translation answer: shows when a word is pinched, fades after about 8 seconds or when another word is pinched (default).
- Dance/pose button: appears only after she has come over, hides when she walks away (default).
- If something needs attention out of view: nothing should be out of view; she re-centers in front when the user turns away. Her voice still comes from where she stands (spatial sound).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. At start, the companion is in front of the user about 2.5 m away, slightly to the right so she doesn't cover the desk work, doing her own idle actions; her whole body is in view when looking down toward the desk (about 14° below level, the natural working gaze). Turning the head far to the left or right (or behind) makes her glide back to the front of view within about 2 s.
2. After about 20 seconds without interaction, she walks closer and teases me with a line (voice + subtitle beside her).
3. Pinching the Call button on the desk makes her say "What's up?" and walk up to about 1.2 m in front of me, face and upper body in view.
4. Pinching a highlighted word on the foreign-language page makes her answer, and the translation/reading appears right next to that word, then fades.
5. Grabbing the book on the desk and handing it to her makes her open it and give a short summary (voice + subtitle).
6. Pinching the Mode button cycles her mode and she answers in the new mode's voice; in Cue cards mode, pinching Next shows the next card beside her, and the last card makes her say "You did great!".

## Out of scope
- Real camera vision: reading real books, signs, or zooming into real objects.
- Live AI conversation as a requirement (optional extra only), and voice recognition in the preview.
- Memory between sessions: her learning and growing over time, AI-Brain sync.
- Using it in a lecture with an audience, mirroring to a phone, a phone-app version.
- Book digitization service / crowdfunding, a robot body (physical / embodied AI). Future vision only.
- Sexual content of any kind.

## Risks and open questions
- Video-character limits (accepted by the learner): flat when seen from the side; small jumps between clips; mouth movement is generic, not matched to words; each clip MP4/H.264 under 10 MB, total Lens under 25 MB.
- Earlier biggest build risk (now addressed by the video character): a life-size animated human character (walking, idle, approaching, reading, dancing). Her looks are the learner's top priority, so the character model's quality comes first. AI 3D generation may need a Snap login that currently fails; an alternative source for a rigged, beautiful, photoreal character may be needed. On the additive display dark areas (hair, eyes, shadows) render see-through, so a photoreal person will look partly translucent; the preview simulates this. Learner keeps photoreal (not anime).
- Innovation: AI companion apps and devices already exist (e.g. Replika, Gatebox). The difference to show is that she shares my real space and what I'm looking at.
- Learner wants her look "attractive/sexy" and gravure-model-like; kept to elegant, non-revealing, non-sexual so the public video stays within Snap's rules.
- Chloe is the learner's separate AI-character brand; a Chloe-like look is fine but the face must differ so the brands aren't publicly linked.
- Language: she speaks Japanese with Japanese + English subtitles so English-speaking judges can follow (default; open).
- Voice lines are pre-recorded (default).
- Feel unproven: what it feels like to have someone always in front of you over a long work session (lazy-follow comfort); real hand tracking.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
