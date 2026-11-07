# Devpost submission text (DRAFT — fill [TBD] after the build and tests)

## Name
Yorisoi (寄り添い, "staying close beside someone")

## Tagline
An AR companion who lives in your real room, shares what you're looking at, and helps you read what you can't.

## Inspiration
A companion on a screen or in VR always feels fake: everything around her is made up, so you think "this isn't real." On glasses she can stand in your actual room, next to your actual desk, and look at the same page you're looking at. We wanted to see what it feels like to work with an AI partner who is *in your space* instead of in a window.

## What it does
- While you work at your desk, she spends time around the room on her own: walking, turning, doing her own thing. When she is out of your narrow field of view, her voice comes from where she is.
- If you haven't talked to her for a while, she comes over and teases you a little: "What are you doing? Anything I can do?"
- Press the big Call button on your desk and she says "What's up?" and walks up in front of you.
- Point at a word you can't read in a foreign book on your desk (English, Korean, hard kanji). She tells you what it says, and the answer appears right next to the word, then fades.
- Hand her the book and she opens it, reads, and gives you a short summary.
- She answers in Japanese with Japanese and English subtitles beside her.
[TBD: adjust to what was actually built and tested]

## How we built it
- **Planned with the plan-lens skill pack**: a learner-led interview turned the idea into `devpost/design-brief.md` (approved before any building started).
- **Built with CLAD in Lens Studio 5.24.1 through the Lens Studio MCP server**: CLAD's experience builder created the scene, SIK interactables (Call button, pinchable words, grabbable book) and TypeScript behavior scripts.
- **Tested with LEAF**: one scenario per done criterion, run in the Lens Studio preview. [TBD: pass/fail table]
- Spectacles Interaction Kit and UI Kit for all input, real-world scale in centimeters, spatial audio for out-of-view cues, light-colored text for the additive display.

## Challenges we ran into
- **The MCP connection looked dead but wasn't.** Lens Studio's MCP server was running, but a local antivirus web filter rewrote loopback HTTP responses (it declared chunked encoding without chunk framing), so the agent's HTTP client rejected every reply. We confirmed it by sending a correct response from our own test server and receiving the same corruption, then wrote a small stdio bridge that talks to the MCP server over a raw socket and parses replies tolerantly.
- **No MCP tools until the AI plugins were trusted.** The Lens Studio AI plugins (LEAF, AI Assistant, Agents-Docs) are downloaded after first launch and only load after a restart and per-plugin permission prompts.
- **A believable person on an additive display.** Dark areas render see-through, so a photoreal character looks partly translucent; we kept her clothes and hair light-colored. [TBD: how the character model was produced]
- **Sensing we can't show in the preview.** The preview can't read real text or hear voice, so reading a word is a pinch on a highlighted word and talking to her is a Call button, with hard-coded answers.

## Accomplishments that we're proud of
[TBD after tests]

## What we learned
- Design for the narrow field of view: let the companion live outside it and come into view when called, with sound pointing to where she is.
- Put information on the thing it's about: the translation appears next to the word, not on a floating panel.
- [TBD]

## What's next
- Real speech recognition on the glasses and a live AI behind her answers.
- Real camera reading of books and signs.
- Memory across sessions so she learns what you read together.
- Longer term: the same companion carried into a physical (embodied) AI body.

## Built with
Lens Studio, SPECS, CLAD, Lens Studio MCP, LEAF, Spectacles Interaction Kit, Spectacles UI Kit, TypeScript, plan-lens skill pack

## Links
- Video: [TBD — YouTube, public, under 3 minutes]
- Repo: [TBD — public GitHub repo with the Lens Studio project and devpost/]
