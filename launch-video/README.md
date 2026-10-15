# Speedy Dial launch video

> **In the GitHub repository** this folder holds the source only. The finished MP4 is a release download, and the large generated files (the Tesseract project, the screen recordings and the music WAV) are left out. Rebuild them with the steps below: the recordings with `capture/`, the music with `tools/make-music.js`, the project with `node build.js`.

A 49.75-second, 1920×1080, 30 fps product video. The feature scenes are screen recordings of the real extension, not mock-ups. There is an original synthesized soundtrack.

| What | Where |
| --- | --- |
| Finished render | `renders/speedy-dial-launch.mp4` |
| Editable Tesseract project | `project.tsrct` |
| Source of the project (scenes, headlines, timings, colours) | `build.js` |
| Contact sheets of the whole video | `Previews/` |
| Screen recordings of the extension | `assets/footage/` |
| Music | `assets/audio/speedy-dial-theme.wav`, made by `tools/make-music.js` |
| Logo and font | `assets/brand/`, `assets/fonts/` (Instrument Sans, SIL Open Font License) |

## Scenes

1. Intro: logo and tagline
2. The dial grid, with a card hovered
3. History sidebar: hover the right edge, pin it
4. Widgets sidebar: clock, calendar, notes, a to-do typed and ticked off
5. Crisp icons: right-click, Change icon, search by name, pick one
6. Two looks: Settings, Material 3 switched on, the whole page restyles
7. One-click add: the toolbar button, then the new dial pops in
8. Outro

The sites, history entries and tasks in the recordings are sample data. Their logos belong to their owners.

## How the recordings were made

The extension's real files run in an ordinary browser tab. `capture/server.js` serves them and `capture/stub.js` stands in for the `chrome.*` APIs (storage, history, top sites) and for the extension's permission to fetch other sites' icons. Nothing in `speed-dial/` is changed for this.

Each `capture/scene-*.js` file is a Playwright script. It steps the page's animation clock one frame at a time and takes a screenshot per frame, so the footage is smooth whatever the machine's speed. A cursor is drawn on the page, since a screenshot does not include one. The frames were then encoded with ffmpeg into `assets/footage/*.mp4`.

To record again, set `REPO` at the top of each scene script to the folder you cloned this repository into, run `node capture/server.js`, then run a scene script with Playwright's `browser_run_code_unsafe` and encode the frames:

```
ffmpeg -framerate 24 -i capture/frames/grid/f%04d.jpg -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p assets/footage/grid.mp4
```

## Changing the video

Edit `build.js`, then rebuild and render. This needs Tesseract 0.4.0 (`tsrct`) installed at `%LOCALAPPDATA%\Tesseract`.

```
node build.js            rebuilds project.tsrct from scratch
node build.js export     renders renders/speedy-dial-launch.mp4
```

Rebuilding replaces `project.tsrct`, so edits made directly in the project are lost. If you change a scene's length, keep `SCENES` and `DUR` in `tools/make-music.js` in step with the scene starts that `build.js` prints, then run `node tools/make-music.js`.

## Music

The track is made from code, so it carries no licence: 110 BPM in C major with a pad, bass, a plucked arpeggio and soft drums from the dial-grid scene on, a chime on each scene change, and fades at both ends. To use a different track, put an MP3 or WAV in `assets/audio/`, point the `import-asset` line in `build.js` at it, and rebuild. `MUSIC_VOLUME` at the top of `build.js` sets its level.

## Tools

- `tools/make-music.js` writes the soundtrack.
- `tools/wav-levels.js` prints a WAV's loudness second by second.
- `tools/calib.js` measures where Instrument Sans capitals sit inside a text box. `build.js` uses that to centre labels.
- `tools/mp4info.js` prints an MP4's duration, frame size, frame count and whether it has audio.
- `tools/schema-variant.js` prints the fields of one layer type from the project schema.
