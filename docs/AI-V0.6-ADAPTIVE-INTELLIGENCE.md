# ShinaYuu AI 4.1 — Personal Music Agent

ShinaYuu Music 2.5.0 keeps the AI assistant isolated from the playback critical path while adding four intelligence layers: conversational memory, behavioral learning, preference-aware recommendation ranking, and deterministic Smart Next selection.

## Conversational memory

The AI keeps a small rolling conversation window in the local ShinaYuu AI memory file. This lets the model resolve short follow-ups such as “bài này”, “bài đó”, “như lúc nãy”, “thêm vài bài”, or “bản gốc”. The stored window is bounded and contains only the assistant/user text needed for continuity.

## Behavioral learning

The memory engine learns from playback events already emitted by the AI client: `play_start`, `play_complete`, `skip`, `search`, `interaction`, `volume`, `like`, and `dislike`. Likes and completed plays increase preference signals; repeated skips and dislikes create negative signals.

The learning layer remains music-specific. It does not infer sensitive personal attributes.

## Personalized discovery

Search results are still produced by the real ShinaYuu providers. AI does not invent tracks. A deterministic re-ranker then combines the user request with learned signals for:

- artist affinity
- style and mood affinity
- language
- version preference
- remix/live/nightcore/slowed avoidance
- instrumental/vocal preference
- repeated skip/dislike signals

This means the AI can return different ordering for different listeners without replacing the underlying providers.

## Smart Next

When the model requests `smart_next`, ShinaYuu chooses a candidate from the real active queue using the deterministic selector. The model does not invent an arbitrary queue index.

## Tooling

Two new AI tools are available to model-backed providers:

- `rate_current_track` — records an explicit like/dislike for the current track.
- `recommend_music` — calls the real ShinaYuu discovery engine and returns personalized ordering information.

The existing `search_music`, `play_music`, `create_smart_playlist`, `control_player`, `verify_lyrics`, and memory tools remain available.

## Configuration

The following options default to enabled when AI memory is enabled:

```json
{
  "adaptiveMemory": true,
  "conversationMemory": true,
  "preferenceReranking": true,
  "smartNext": true
}
```

Environment equivalents are supported with the `SHINAYUU_AI_` prefix, for example `SHINAYUU_AI_ADAPTIVE_MEMORY=0`.

## Safety / reliability boundary

AI remains advisory and action-based. Playback, provider ownership, Widevine, YouTube, Spotify, SoundCloud, lyrics timing and AutoMix do not depend on the AI being available. A provider failure falls back through the configured AI provider order or to the local deterministic brain for supported commands.


## AI 4.1 agent layer
AI 4.1 adds deterministic intent/context planning, bounded multi-step tool orchestration, recommendation quality gates, verified playback actions, and context-aware follow-up handling. The agent layer remains outside the playback critical path.
