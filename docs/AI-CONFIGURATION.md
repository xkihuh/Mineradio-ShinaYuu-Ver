# ShinaYuu AI 2.3.0 — One-key configuration

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
