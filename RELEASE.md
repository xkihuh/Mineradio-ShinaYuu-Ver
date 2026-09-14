# ShinaYuu Music 2.4.0 — AI + Cuefield Intelligence Release

## Overview

ShinaYuu Music 2.4.0 is a controlled evolution of the 2.3.x AI line. It preserves the existing provider and playback ownership architecture while combining AI user intelligence with the selectively ported Cuefield transition-planning layer derived from Mineradio v2.2.0.

## AI Intelligence

- Persistent AI Memory 2.0 for non-sensitive music habits and explicit preferences.
- Vietnamese music-intent understanding for broad labels such as EDM, remix, chill, mood and reference artists.
- Runtime context for local date/time, timezone, locality and current weather using one location/time context.
- Smart Search, Smart Playlist, Smart Queue, natural-language controls and provider failover remain isolated from the playback critical path.
- Deterministic fast-path handling keeps routine player commands responsive.

## Cuefield Intelligence

The release contains a controlled port of selected Mineradio v2.2.0 Cuefield planning improvements (commit `9402566`):

- musical profile and compatibility scoring
- structure maps and section candidates
- boundary evidence and lyric-aware links
- transition-window planning and routing
- bridge/rescue planning
- transition artifacts and shadow diagnostics
- upgraded execution with a legacy ShinaYuu planner fallback

The upstream provider/playback ownership model is not copied. Cuefield operates as an isolated planning layer inside ShinaYuu.

## Reliability rule

A Cuefield planning failure must not become a playback failure. The upgraded planner is attempted first; when it throws, returns an invalid plan, or cannot produce a safe transition, the legacy ShinaYuu planner remains available.

## Release identity

- Desktop version: **2.4.0**
- Build identity: **2.4.0 / 2.4.0.0**
- Previous release: **2.3.0**

## Historical documentation

Files describing 2.2.x or earlier behavior are retained when they document historical implementation decisions. Their filenames are not treated as current release identity.
