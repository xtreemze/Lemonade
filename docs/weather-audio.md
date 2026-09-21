# Weather music

The Apple II version of Lemonade Stand did not use anonymous jingles. Its weather-report
routine encodes short pitch/duration excerpts associated with recognizable songs:

| Weather | Historical tune used by the Apple II game | Revival treatment |
| --- | --- | --- |
| Sunny | Rossini, **Ranz des Vaches / Call to the Dairy Cows** from *William Tell* | Historical Apple II excerpt followed by an original bright cadence |
| Cloudy | **Raindrops Keep Fallin’ on My Head** — Burt Bacharach / Hal David | Historical Apple II excerpt followed by an original rain-like variation |
| Hot and dry | **Summertime** — George Gershwin / DuBose Heyward | Historical Apple II excerpt followed by an original slow heat-haze variation |
| Thunderstorm | **Singin’ in the Rain** — Nacio Herb Brown / Arthur Freed | Historical Apple II excerpt followed by an original darker cadence, with procedural thunder layered separately |

The primary historical reference is the released Applesoft BASIC source linked from the
project README. Contemporary histories of Lemonade Stand also identify the weather-song
mapping.

## Revival arrangement rule

Each forecast lasts **6 seconds**. The audio compiler:

1. reproduces the short Apple II pitch/duration excerpt already encoded by the historical game;
2. leaves a brief phrase boundary;
3. continues with newly authored notes that borrow only the excerpt's general contour,
   register and mood;
4. resolves the phrase at approximately **5.88 seconds**, leaving a short release before
   the forecast screen transitions.

The continuation is deliberately an original variation rather than a transcription of the
remainder of the corresponding song. This keeps the historical reference recognizable while
giving every weather state a complete musical gesture suitable for the game.

The compiler tags tones as either `historical-weather-excerpt` or
`original-weather-variation`. Tests protect that boundary so future refactors cannot
accidentally replace the historical prefix or expand a continuation into an undocumented
transcription.

## Runtime rules

- Weather audio is presentation only and never participates in simulation RNG or accounting.
- No recorded audio assets or lyrics are shipped.
- The historical excerpt keeps the Apple II-style square-wave character.
- Original continuations can use restrained square, triangle and sine timbres for a fuller
  six-second phrase.
- Thunder remains a separate procedural sound effect so the melodic storm cue stays legible.
- Audio may be muted or unavailable without affecting gameplay.
