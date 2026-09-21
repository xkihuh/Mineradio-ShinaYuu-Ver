# ShinaYuu AI 2.5.1 — One-key configuration

For a personal/internal build, you only need to edit `package.json` and put the provider key in `shinayuuAI.apiKey`.

Default Gemini setup:

```json
"shinayuuAI": {
  "enabled": true,
  "provider": "gemini",
  "apiKey": "YOUR_GEMINI_API_KEY",
  "apiUrl": "auto",
  "model": "auto",
  "reasoning": "medium",
  "webSearch": false,
  "toolCalling": true,
  "memory": true,
  "adaptiveMemory": true,
  "conversationMemory": true,
  "preferenceReranking": true,
  "smartNext": true,
  "cache": true,
  "failover": true,
  "timeoutMs": 25000
}
```

With `auto`, ShinaYuu derives the Gemini API URL and model automatically. Current defaults are the Gemini Interactions endpoint and `gemini-3.8-flash`; transient model/capacity errors fall back to `gemini-3.7-flash` and then `gemini-3.6-flash`.

To use OpenAI instead:

```json
"shinayuuAI": {
  "provider": "openai",
  "apiKey": "YOUR_OPENAI_API_KEY",
  "apiUrl": "auto",
  "model": "auto"
}
```

The OpenAI URL is automatically set to `https://api.openai.com/v1/responses`. The code can use the configured primary model and fall back to `gpt-5.6` when the primary model is temporarily unavailable or inaccessible.

## Persistence across EXE updates / patches

At first launch ShinaYuu creates:

`%APPDATA%\\ShinaYuu Music\\ai-config.json`

This file is outside the installed application and is therefore preserved when an EXE, NSIS installer, or update patch replaces application files. User configuration takes precedence over package defaults. This means a user's own API key does not need to be re-entered after every update.

## Security warning

A real API key placed in `package.json` becomes part of the application distribution. Because this build uses `asar: false`, a person with the installed files can extract that key. This is acceptable for a personal/private build, but **do not ship a shared provider key in a public EXE**. For public distribution, each user should put their own key in the persistent AppData configuration or, preferably, enter it through a future in-app AI Settings page.

Environment variables are still supported and override package/user configuration for advanced setups.


## AI 4.1.1 Personal Music Agent

ShinaYuu Music 2.5.1 stores a bounded local conversation window, learns non-sensitive music preferences from likes/skips/completions and explicit interactions, re-ranks real provider search results using those signals, and chooses Smart Next from the actual queue. The adaptive layer stays outside the playback critical path. AI 4.1.1 adds intent planning, multi-step tool execution, recommendation verification, and safe final-action verification without taking ownership of playback internals.


### AI 4.1.1 agent controls
`agentPlanning` enables deterministic intent planning. `agentVerification` enables tool/result and final-action verification. `agentMaxToolRounds` limits the model tool loop to prevent unbounded execution. Environment variables: `SHINAYUU_AI_AGENT_PLANNING`, `SHINAYUU_AI_AGENT_VERIFICATION`, `SHINAYUU_AI_AGENT_MAX_TOOL_ROUNDS`.


### AI 4.1.1 transaction safety
AI 4.1.1 treats playlist replacement as a supervised music transaction. A request to replace the current queue while keeping the current track uses provider-isolated search, verified track payloads, an AutoMix release barrier and a single queue mutation. The current media element is not restarted by the transaction.
