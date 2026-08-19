# KUKU RADIO — rebuild notes

## Deploying this
Drop everything in this zip straight into the root of your `kukuradio` repo,
overwriting `index.html`, `manifest.webmanifest`, and `sw.js`, and adding the
new `css/`, `js/`, and `data/` folders alongside your existing `audio/`,
`audio_1/`, `icons/`, and `picture/` folders (those four are untouched —
nothing in this zip duplicates them). Commit and push; Netlify redeploys
automatically like before.

## What actually changed

**Hidden, unpredictable playback.** Each station now opens on a random track
and picks an unpredictable next track when one ends — never sequential,
never starting on track 1. There's no visible track list or song count
anywhere anymore; Now Playing shows only the current title, elapsed/remaining
time, and the station. Full explanation of how, if useful later: each station
shuffles its own tracks (Fisher–Yates) into a "bag," rebuilt fresh on every
station switch; "Next" pops from that bag (reshuffling when it empties,
never repeating the song that just ended); "Previous" replays what you
actually just heard rather than stepping through the list, same as shuffle
mode in Spotify/Apple Music.

**Live listener count.** Ambient counter, as you asked — no backend, just a
believable number that drifts around an hour-aware baseline (a little
busier in the evening). It's atmosphere, not real presence data.

**Song data moved out of the code.** All 137 tracks live in `data/
stations.json` now instead of buried in a 1,900-line HTML file — add a song
by adding one `{ "title": ..., "file": ... }` line to the right station's
`tracks` array, no code required. Add a whole new station the same way
(there's already a spot for it: `100.1 Punjabi Funk` and `103.5 Party Vibes`
are wired up and waiting, they'll show "This frequency's still quiet" until
you add tracks).

**A few small fixes along the way:**
- "Shayad Love Aaj Kal" was listed twice inside Missing You by accident —
  deduped to one.
- The "artist" line under the track title always just said "KUKU RADIO" on
  every track, so it's gone — the title has more room now.
- If a track's audio file 404s, the station now auto-skips to the next one
  after a moment instead of silently stalling.
- Background-image error messages now name the actual station instead of
  always saying "Missing You" (copy-paste leftover in the original).

**Structure.** `css/` is split into base (reset/layout), themes (the six
per-station palettes), components, and animations. `js/` is ES modules —
`app.js` is the entry point, `player.js` is the playback engine described
above, `dial.js`/`background.js` are presentation, `live-count.js` and
`pwa.js` are self-contained. `sw.js` keeps the exact same network-first
strategy as before (so new songs/edits show up immediately for return
visitors) — the cache list was just updated to match the new file layout.

## Worth knowing, not yet acted on
19 audio files already sit in your `audio/`/`audio_1/` folders but aren't in
any station's playlist yet — mostly older Bollywood/romantic tracks plus one
English track and one instrumental. Didn't guess which station each belongs
in since that's a mood call, not a code one — happy to slot them in if you
tell me where they go, or you can add them directly in `data/stations.json`.
