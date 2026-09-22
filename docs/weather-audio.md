# Weather music

The Apple II version of Lemonade Stand did not use anonymous jingles. Its weather-report
routine encodes short pitch/duration excerpts associated with recognizable songs:

| Weather | Historical tune used by the Apple II game | Revival treatment |
| --- | --- | --- |
| Sunny | Rossini, **Ranz des Vaches / Call to the Dairy Cows** from *William Tell* | Preserve the Apple II cow-call, then answer it with the same recognizable contour |
| Cloudy | **Raindrops Keep Fallin’ on My Head** — Burt Bacharach / Hal David | Preserve the Apple II opening, then complete the next recognizable melodic clause |
| Hot and dry | **Summertime** — George Gershwin / DuBose Heyward | Preserve the Apple II opening, then continue the identified melody to a natural phrase boundary |
| Thunderstorm | **Singin’ in the Rain** — Nacio Herb Brown / Arthur Freed | Preserve the Apple II opening, then continue the identified melody to its next cadence while procedural thunder remains separate |

The primary historical reference is the released Applesoft BASIC source linked from the
project README. The tune identities are retained as provenance so the procedural revival does
not drift into unrelated music.

## Revival arrangement rule

Each forecast remains **6 seconds**. The audio compiler:

1. reproduces the short Apple II pitch/duration excerpt at its original timing;
2. leaves a brief phrase boundary;
3. continues the identified melody as a short synthesized cover/reinterpretation;
4. lets the musical clause reach its own cadence instead of stretching the historical excerpt or
   replacing it with unrelated filler.

The six-second visual duration is a presentation contract, not a requirement that every note be
time-warped to end at exactly 5.88 seconds. Current phrase completions are arranged to resolve
inside the forecast window, but the audio model must prefer completing a phrase over truncating
one merely to hit a visual timestamp.

The compiler tags tones as either `historical-weather-excerpt` or
`source-phrase-completion`. Tests protect the historical prefix, the recognizable continuation
pitch contour, the phrase boundary, and the square-wave character.

## Runtime rules

- Weather audio is presentation only and never participates in simulation RNG or accounting.
- No recorded audio assets or lyric assets are shipped; the melodies are synthesized from note
  and duration data at runtime.
- The historical excerpt keeps the Apple II-style square-wave character and its original timing.
- Phrase completions use the same emulated square-wave voice so the melody remains coherent
  instead of changing instrument character halfway through the cue.
- The compiler does not stretch an excerpt to consume the full forecast duration.
- Thunder remains a separate procedural sound effect so the melodic storm cue stays legible.
- Audio may be muted or unavailable without affecting gameplay.
