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
