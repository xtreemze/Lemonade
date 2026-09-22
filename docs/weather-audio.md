# Weather music

The Apple II version of Lemonade Stand did not use anonymous jingles. Its weather-report
routine encodes short pitch/duration excerpts associated with recognizable songs.

| Weather | Tune | Verified phrase boundary |
| --- | --- | --- |
| Sunny | Rossini, **Ranz des Vaches / Call to the Dairy Cows** from *William Tell* | one complete cow-call motif |
| Cloudy | **Raindrops Keep Fallin’ on My Head** — Burt Bacharach / Hal David | the complete title phrase |
| Hot and dry | **Summertime** — George Gershwin / DuBose Heyward | the opening phrase through its first cadence |
| Thunderstorm | **Singin’ in the Rain** — Nacio Herb Brown / Arthur Freed | the paired title clauses around the original encoded rest |

The primary historical source is the released 1979 Applesoft BASIC program. Its weather DATA
tables contain the exact pitch-period and duration values used by the original game. Those
fragments already terminate on deliberate phrase boundaries: long final notes and, where
appropriate, explicit rests. They do not need invented continuation notes merely because the
modern forecast screen lasts six seconds.

## MIDI references

These external MIDI references are for verification of tune identity, phrase shape and future
source-backed extraction. The application does not bundle these third-party MIDI files.

- Sunny: https://www.flutetunes.com/tunes/rossini-william-tell-ranz-des-vaches-trio.mid
  - companion page: https://www.flutetunes.com/tunes.php?id=2800
  - G major, 3/8, 76 BPM
- Cloudy:
  https://www.midishow.com/en/midi/raindrops-keep-falling-on-my-head-midi-download-121835
  - GM1 MIDI, 120 BPM, explicit VOICE melody track
- Hot and dry: https://www.midi.com.au/george-gershwin/summertime-midi/
  - professional MIDI arrangement with MIDI melody
  - additional downloadable reference:
    https://www.midishow.com/en/midi/101384.html
- Thunderstorm: https://www.midishow.com/zh-tw/midi/60007.html
  - GM1 MIDI, F major, 4/4, 140 BPM

Any future extension must be produced by parsing a cited MIDI/score source and selecting a
contiguous phrase. Hand-authored substitute notes are not permitted.

## Timing

The visual forecast lasts **6 seconds**, but audio duration is independent of that presentation
timer. At the original emulation timing the current excerpts finish comfortably before the
transition:

- sunny: about 2.25 seconds including inter-note gaps;
- cloudy: about 1.60 seconds;
- hot and dry: about 2.51 seconds;
- thunderstorm: about 2.77 seconds.

Silence after the phrase is preferable to filling the remaining time with music that is not in
the source melody.

## Runtime rules

- Weather audio is presentation only and never participates in simulation RNG or accounting.
- No recorded audio assets or lyric assets are shipped.
- Weather notes come from the original Apple II DATA tables unless a future change is directly
  extracted from a cited source MIDI or score.
- The Apple II-style square-wave character and original timing are preserved.
- The compiler must not stretch the excerpt to consume the forecast duration.
- Thunder remains a separate procedural sound effect so the melodic storm cue stays legible.
- Audio may be muted or unavailable without affecting gameplay.
