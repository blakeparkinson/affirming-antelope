# Voice role-play (v1: pipeline)

Learner speaks → transcribed → the existing role-player replies (text, streamed) →
the reply is spoken in the persona's voice. Everything downstream (observer, coach,
debrief, trainer review) is unchanged: it works on the transcript.

Built so a realtime speech-to-speech provider can replace the pipeline later behind
the same client hook (`useVoiceTurn`), without changing screens.

## Decisions

- **Hold to talk.** Press and hold the mic, release to send. Never cuts the learner off
  mid-thought; pauses to think are fine (MI needs them). Slide away to cancel.
- **Text mode stays.** Every role-play offers Talk or Type on the brief; the choice is
  remembered. Voice for free-text drills is a later step.
- **No audio is stored.** Learner audio goes to the transcription provider and is
  discarded; only the transcript is kept (as today). `practice_sessions.mode = 'voice'`.
- **Captions always.** The persona's reply shows as text while it plays (accessibility,
  noisy rooms). A "Mute voice" toggle keeps the text but stops playback.
- **Provider: OpenAI** for transcription and speech (current models; verify names and
  prices in the docs at build time). Claude stays the role-player.

## API (apps/web, Node runtime, same auth + quota as the AI routes)

### `POST /api/voice/transcribe`
- Auth: `Authorization: Bearer <supabase access token>` (anonymous or permanent).
- Body: `multipart/form-data` with `audio` (web: `audio/webm;codecs=opus` or `audio/mp4`;
  iOS native: `audio/m4a`), `scenarioId`, `durationMs`.
- Limits: ≤ 60 s, ≤ 5 MB. 413 if larger.
- Response `200 { text: string, durationMs: number }`.
- `422 { error: "no_speech" }` when nothing intelligible was said (client: "Didn't catch
  that. Hold and try again.").
- The scenario's persona name and context may be passed to the model as a prompt/hint
  to improve proper nouns ("Josh", "A1c", "statin").

### `POST /api/voice/speak`
- Auth as above. Body JSON `{ scenarioId: string, text: string }` (≤ 600 chars).
- Response: streamed `audio/mpeg` of `text` in the persona's voice. Client calls it per
  sentence as the role-player's text streams, prefetching the next sentence while the
  current one plays.
- Voice per persona comes from `packages/core` (`persona.voice`), never from the client.

### Quotas (`app_private.ai_quota_limits`)
New buckets `stt` and `tts`, counted per request, lower for anonymous users; the global
circuit breaker covers them. 429/503 bodies match the existing AI routes.

### Mock mode (`AI_MOCK=1`)
`transcribe` returns a scripted learner line keyed off `durationMs`; `speak` returns a
short valid MP3 (silence or tone) whose length scales with the text, so the client's
playback queue can be built and tested without OpenAI.

## Core (`packages/core`)

`Persona.voice?: { openai: string; instructions: string }`: an OpenAI voice id and
style instructions (age, pace, warmth, guardedness), e.g. Len Kessler: "61-year-old
man, unhurried, a little gravelly, polite but guarded; warms up slowly." Every scenario
gets one; voices should differ across the cast.

## Client (apps/mobile; web build and native)

- `useVoiceTurn()` hook: record (expo-audio; MediaRecorder on web), upload, transcribe,
  then hand the text to the existing turn flow; consume the streamed reply, split into
  sentences, queue `speak` requests, play in order (expo-audio), expose state:
  `idle | recording | transcribing | thinking | speaking`.
- iOS Safari: unlock audio playback inside the mic press gesture (first play must start
  from a user gesture); handle mic permission denial with a clear fallback to Type.
- UI: a large hold-to-talk button in the composer slot with live level meter, a
  "Listening…" state, the transcript appearing as the learner's bubble, the persona's
  avatar animating while speaking, captions streaming. Interrupt: pressing the mic while
  the persona speaks stops playback and starts recording.
- Analytics (ids/enums only): `voice_turn_recorded {scenario_id, duration_ms}`,
  `voice_transcribe_failed {reason}`, `practice_started` gains `mode: 'text' | 'voice'`.
- Trainer review shows "Voice" as the mode (field already exists).

## Server implementation notes (as built)

- Models (`VOICE_MODELS` in `packages/core`, env override `AI_VOICE_STT_MODEL` / `AI_VOICE_TTS_MODEL`):
  `gpt-transcribe` (about $0.0045/min) and `gpt-4o-mini-tts` (about $0.015/min of speech).
- Error bodies are `{ error, code }`. `transcribe`: 422 `no_speech`, 413 `audio_too_large` or
  `audio_too_long`, 415 `unsupported_audio` (container detected from the bytes: webm, mp4/m4a,
  wav; the declared type is ignored), 400 bad fields. Either route: 503 `voice_unavailable`
  (no OpenAI key in production, or OpenAI out of credits) means switch to Type; 429
  `quota_exceeded` and 503 `ai_resting` match the other AI routes.
- Quotas per UTC day / per minute: anonymous stt 60 / 8, tts 200 / 30; permanent stt 300 / 15,
  tts 1000 / 60; global ceilings 5000 stt and 25000 tts. The legacy shared-token tier is
  refused (401): voice needs a Supabase user.
- `speak` sends `Cache-Control: private, no-store` and no Content-Length (chunked stream).
