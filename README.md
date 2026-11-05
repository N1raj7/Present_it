# Present_it

A ghost teleprompter for your own presentations. A small floating "notch" shows your script and **follows your voice**, it is **excluded from screen share/recording**, and when someone asks a question, a free AI model drafts an answer in a second floating panel that only you can see.

## Features
- **Voice-following script**: transcribes your mic, fuzzy-matches against your script (tolerates ad-libbing, skipped words and mis-heard words) and highlights/scrolls to where you are.
- **Hidden from capture**: `setContentProtection` on every window (notch, answer panel, settings).
- **Question listener**: captures system audio (what you hear on a call), detects questions, asks an LLM that has your script as context, and streams the answer to a side panel.
- **Free-friendly**: speech-to-text and LLM both use OpenAI-compatible endpoints. Presets for Groq (free tier), Gemini (free tier) and Ollama / local Whisper (fully offline).
- Frameless, always-on-top, draggable (top bar), resizable (bottom-right grip), adjustable opacity and font size.

## Setup
```bash
npm install
npm start
```
On first run the settings window opens. Paste your script and add keys:
- **Speech-to-text**: free key from <https://console.groq.com> (Whisper large-v3-turbo).
- **AI answers**: same Groq key works, or a free Gemini key, or point at local Ollama (no key).

Run tests for the matching logic: `npm test`. Build installers: `npm run dist`.

## Hotkeys (global)
| Keys | Action |
|---|---|
| Ctrl/Cmd+Shift+H | Hide / show everything |
| Ctrl/Cmd+Shift+M | Start/stop following your voice |
| Ctrl/Cmd+Shift+L | Start/stop listening for questions |
| Ctrl/Cmd+Shift+↓ / ↑ | Manually move script forward / back 8 words |
| Ctrl/Cmd+Shift+A | Show / hide the answer panel |
| Ctrl/Cmd+Shift+C | Toggle click-through on the notch |

You can also click any word to jump there, or use the arrow keys while the notch has focus.

## Status (v0.1.0)

| Area | State |
|---|---|
| Floating notch, drag to move | Works |
| Voice-following script (Groq Whisper) | Works (confirmed on Windows), but has noticeable lag |
| Hidden from screen share | Implemented (`setContentProtection`); verify on your own call app before relying on it |
| Settings window, autosave script | Works |
| Resizing the notch / answer panel | **Not working yet** (bottom-right grip needs fixing) |
| Question detection + AI answer panel | **Failing** (needs debugging; see below) |
| System-audio capture (Listen) | Untested end to end |

## Known issues
1. **Highlight lags your voice.** Audio is sent in chunks (up to ~4 s, or when you pause ~0.5 s) and the pointer only moves after a chunk is transcribed and returned.
2. **No resize.** The custom resize grip does not resize the frameless transparent window on Windows. Needs a fix (see roadmap).
3. **Question to AI answer flow fails.** Listen mode / AI answers do not work yet. Likely suspects: system audio loopback not delivering an audio track, the LLM model id or key in Settings, or the question detector not triggering. Needs logging to find out which.
4. Whisper sometimes hallucinates phrases on silence; a small filter drops the common ones.
5. `npm audit` reports warnings from build-time dependencies; they do not affect the running app.

## Roadmap
- [ ] **Faster following**: shorter chunks (about 1.5 s) and update the pointer on *partial* results mid-sentence instead of waiting for a full chunk to finish; overlap chunks so words at the boundary are not lost.
- [ ] **Lower-latency STT**: streaming recognition (Vosk or whisper.cpp locally) instead of one API call per chunk.
- [ ] **Fix resize**: reliable resize for the notch and answer panel (edge handles, or drag-resize through the main process with a visible grip).
- [ ] **Fix question to answer pipeline**: add a debug log/status for each stage (audio captured, transcribed, detected as question, LLM called, answer streamed) and fix whichever stage is failing.
- [ ] Manual "type a question" path verified end to end independent of audio.
- [ ] Optional: reasoning-effort control for gpt-oss models to cut answer latency.
- [ ] Installer build (`npm run dist`) and a no-console launcher.
- [ ] Per-section talking points, slide sync mode, ignore own voice in Listen mode.

## Running without typing commands (Windows)
Double-click `start.bat`, or `start-hidden.vbs` for no console window (make a desktop shortcut to it).

## Suggested free setup (Groq)
Use one Groq key for both fields in Settings.
- Speech-to-text model: `whisper-large-v3-turbo` (faster) or `whisper-large-v3` (slightly more accurate)
- AI answers model: `openai/gpt-oss-20b` (fast) or `openai/gpt-oss-120b` (smarter)
- Base URL for both: `https://api.groq.com/openai/v1`

## Platform notes
- **Windows 10 (2004+) / 11**: capture exclusion and system-audio loopback work out of the box.
- **macOS**: grant Microphone and Screen Recording permission to your terminal/Electron. System-audio loopback may need a virtual device such as [BlackHole](https://github.com/ExistentialAudio/BlackHole); choose it under "Where questions come from". **Some newer macOS versions let ScreenCaptureKit-based tools (including recent Zoom/Meet/OBS builds) capture "protected" windows anyway.** Always do a test recording before presenting for real.
- Whisper can hallucinate on noise; the app drops a few known phantom phrases ("thanks for watching" etc.).

## How it works
`audio.js` slices a stream into speech-bounded 16 kHz WAV chunks → main process sends them to the STT endpoint → `matcher.js` aligns the last ~8 spoken words against a window of upcoming script words → pointer moves. For questions, `detect.js` decides if the heard text is a question and main streams an LLM answer to the answer window.

## Privacy
Audio chunks and your script go to whichever providers you configure. Use Ollama + a local Whisper server to keep everything on your machine. API keys are stored in your OS user-data folder (`config.json`), never in the repo.

## Ideas to extend
Streaming STT (Vosk/whisper.cpp) for lower latency, a script-slide sync mode, per-section talking points, speaker diarization to ignore your own voice.

License: MIT