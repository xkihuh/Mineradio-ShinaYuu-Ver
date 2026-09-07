# ShinaYuu AI v0.2 — Ask ShinaYuu

## What this version adds

- Floating `AI` button and chat panel.
- Current-track context: title, artist, album/source, playing state, queue length and volume.
- Safe actions: play/pause, next, previous, volume, search.
- Local Demo brain works without an API key.
- Optional OpenAI-compatible model provider through environment variables.
- AI is isolated from playback critical paths.

## Optional model configuration

```text
SHINAYUU_AI_API_URL=https://api.openai.com/v1
SHINAYUU_AI_MODEL=<your-model>
SHINAYUU_AI_API_KEY=<your-key>
```

For a local OpenAI-compatible server, point `SHINAYUU_AI_API_URL` at its base URL and omit the key when the server does not require one.

The app never sends audio to the AI layer in v0.1. Only the chat message and small player metadata context are sent.
