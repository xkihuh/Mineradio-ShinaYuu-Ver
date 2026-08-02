# ShinaYuu Music 2.0.17

- Fixed manual song selection during an active AutoMix crossfade.
- Manual selection now waits for the cancelled AutoMix/provider transaction to settle before starting the chosen track.
- Stale AutoMix code can no longer call `playQueueAt`, `nextTrack`, restore old volume, or stop the newly selected provider after losing ownership.
- Preserved the restored lyrics timing controls and updater-logo fix from 2.0.15–2.0.16.
