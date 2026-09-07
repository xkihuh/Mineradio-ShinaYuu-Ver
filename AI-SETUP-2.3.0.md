# ShinaYuu Music 2.3.0 — AI Multi-Provider Setup

## A. Gemini (recommended for free-tier testing)

The current recommended default for ShinaYuu is `gemini-3.7-flash`. Google lists this stable Flash model with a Free Tier and support for everyday/agentic tool use. The current Gemini Interactions API is the recommended interface for new applications.

PowerShell (current terminal):

```powershell
$env:SHINAYUU_AI_PROVIDER="gemini"
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
$env:SHINAYUU_GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/interactions"
$env:SHINAYUU_GEMINI_MODEL="gemini-3.7-flash"
$env:SHINAYUU_AI_WEB_SEARCH="true"
$env:SHINAYUU_AI_TOOL_CALLING="true"
$env:SHINAYUU_AI_MEMORY="true"
$env:SHINAYUU_AI_CACHE="true"
$env:SHINAYUU_AI_FAILOVER="true"
$env:SHINAYUU_AI_REASONING="high"
npm start
```

## B. Automatic provider selection

```powershell
$env:SHINAYUU_AI_PROVIDER="auto"
```

ShinaYuu prefers Gemini when a Gemini key exists, then OpenAI, then Local Demo. With `SHINAYUU_AI_FAILOVER=true`, a secondary configured provider can be tried after a provider request fails.

## C. OpenAI fallback

```powershell
$env:SHINAYUU_AI_API_KEY="YOUR_OPENAI_API_KEY"
$env:SHINAYUU_AI_API_URL="https://api.openai.com/v1/responses"
$env:SHINAYUU_AI_MODEL="gpt-5.6"
```

## D. Save the settings permanently on Windows

```powershell
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_PROVIDER","gemini","User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY","YOUR_GEMINI_API_KEY","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_GEMINI_API_URL","https://generativelanguage.googleapis.com/v1beta/interactions","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_GEMINI_MODEL","gemini-3.7-flash","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_WEB_SEARCH","true","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_TOOL_CALLING","true","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_MEMORY","true","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_CACHE","true","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_FAILOVER","true","User")
[Environment]::SetEnvironmentVariable("SHINAYUU_AI_REASONING","high","User")
```

Close the old terminal and open a new one after persistent environment changes.

## E. Security

API keys stay in the server/main-process environment. Never paste real keys into renderer code, HTML, screenshots, Git commits, or public releases.

## F. AI status check

With ShinaYuu running, open:

`http://127.0.0.1:3000/api/ai/status`

The response exposes the active provider/model and whether a key is present, but never returns the secret value.
