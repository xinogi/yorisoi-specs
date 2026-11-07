---
status: approved
---

# Design brief: Yorisoi — an AR companion who shares your space

<!-- Filled in by plan-lens from the learner's interview (interview held in Japanese; quotes translated). Values the learner didn't choose are marked (default). -->

## The one spatial moment
I'm working at my desk, looking straight ahead. My companion is in the room doing her own thing, moving around me. After a while she comes over and teases me a little: "What are you doing? Anything I can do?" When I call her, she says "What's up?" and walks up in front of me. I point at a word I can't read in a foreign book on my desk, she tells me what it says, and the answer appears right next to the word.

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
- Companion: an original 3D character who is stunningly beautiful (learner: "a super-beautiful 3D girl; I won't compromise on that"), clearly an adult, realistic like a real photo (learner: not anime-style). Learner's image: an ideal, elegant and pure-looking (seiso) model with a great figure, a vibe similar to the learner's own AI character Chloe but with a different face. Outfit: elegant everyday clothes in light colors, e.g. a light blouse and knee-length skirt, not revealing (default; light colors also show better on the additive display). Hair: light brown, long (default). Life-size (about 160 cm tall (default)). She roams 1.5 to 3 m away (front, sides, sometimes facing away), doing her own idle actions. When called she walks up and stops about 1.2 m in front, so her face and upper body are in view (default).
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
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: talking to her uses SPECS speech recognition on real glasses (feel unproven); the Call button does the same job in the preview.

## When things show
- Companion: always in the room, roaming and doing her own thing; comes close only when called or when she decides to tease.
- Teasing: after about 20 seconds with no interaction (default), she walks closer and says "What are you doing? Anything I can do?" / "Want something to eat?"
- Subtitles: show while she speaks, fade about 3 seconds after (default).
- Translation answer: shows when a word is pinched, fades after about 8 seconds or when another word is pinched (default).
- Dance/pose button: appears only after she has come over, hides when she walks away (default).
- If something needs attention out of view: when she is outside the narrow view, her voice and small sounds come from her direction (spatial sound), so I know where she is.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. At start, the companion is in the room 1.5 to 3 m away doing her own idle actions; when she is out of view, her voice/sounds come from her direction.
2. After about 20 seconds without interaction, she walks closer and teases me with a line (voice + subtitle beside her).
3. Pinching the Call button on the desk makes her say "What's up?" and walk up to about 1.2 m in front of me, face and upper body in view.
4. Pinching a highlighted word on the foreign-language page makes her answer, and the translation/reading appears right next to that word, then fades.
5. Grabbing the book on the desk and handing it to her makes her open it and give a short summary (voice + subtitle).

## Out of scope
- Real camera vision: reading real books, signs, or zooming into real objects.
- Live AI conversation as a requirement (optional extra only), and voice recognition in the preview.
- Memory between sessions: her learning and growing over time, AI-Brain sync.
- Using it in a lecture with an audience, mirroring to a phone, a phone-app version.
- Book digitization service / crowdfunding, a robot body (physical / embodied AI). Future vision only.
- Sexual content of any kind.

## Risks and open questions
- Biggest build risk: a life-size animated human character (walking, idle, approaching, reading, dancing). Her looks are the learner's top priority, so the character model's quality comes first. AI 3D generation may need a Snap login that currently fails; an alternative source for a rigged, beautiful, photoreal character may be needed. On the additive display dark areas (hair, eyes, shadows) render see-through, so a photoreal person will look partly translucent; the preview simulates this. Learner keeps photoreal (not anime).
- Innovation: AI companion apps and devices already exist (e.g. Replika, Gatebox). The difference to show is that she shares my real space and what I'm looking at.
- Learner wants her look "attractive/sexy" and gravure-model-like; kept to elegant, non-revealing, non-sexual so the public video stays within Snap's rules.
- Chloe is the learner's separate AI-character brand; a Chloe-like look is fine but the face must differ so the brands aren't publicly linked.
- Language: she speaks Japanese with Japanese + English subtitles so English-speaking judges can follow (default; open).
- Voice lines are pre-recorded (default).
- Feel unproven: what it feels like to have someone roaming around you over a long work session; comfort; real hand tracking.

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
