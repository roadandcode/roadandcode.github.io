# roadandcode.vercel.app

My portfolio site, hosted on Vercel. Plain HTML, CSS and JavaScript with no framework, plus a vendored copy of Three.js for the 3D home page. The only build step collects the playable WebGL builds.

## How it's put together

- `index.html` is the home page: the hero, the seven-stage journey (Concept, Prototype, Polish, Systems, Online, Ship, Console), the work grid, the experience road, about and contact. All the copy is written straight into the HTML, so the page reads fine without JavaScript or WebGL.
- `project.html` is one template for every project page, opened as `project.html?id=<id>`.
- `data/projects.json` holds every project. The grid, the filters, the quest log, the project pages and the footage on the 3D console's screen are all rendered from it.
- `assets/js/world/` is the 3D world behind the home page (see below).
- `assets/js/scroll.js` turns the scroll position into the journey position that both the world and the page effects read.
- `assets/js/journey.js` handles the HTML side of the journey: card fades, the concept-to-console progress bar, the sideways experience road, scrambled headings, tilt and magnetic buttons.
- `tools/build.mjs` assembles `dist/` for deployment: the pages above plus each project's WebGL build under `play/<id>/`.

## The world

Scrolling the home page flies a camera down a road across a contour map, from an idea at one end to a handheld console at the other. Every `[data-stop]` element on the page (the hero, the seven chapters and the work section) is a camera keyframe.

- `world/layout.js` has the road, where each station sits, and the camera keyframe for each stop. Change the framing here.
- `world/stations/` has one file per station. Each returns a group and an `update(time, dt, u)`, where `u` is the camera's position along the keyframes, so a station can animate with the scroll (the greybox dropping in, the paint pass, the console powering on).
- `world/terrain.js` is the contour-map ground and the road, which lights up behind you.
- `world/post.js` is the bloom pass. Colours brighter than 1.0 glow.
- `world/main.js` ties it together: renderer, camera rig, picking for the clickable stations, and quality tiers. Phones and low-core machines skip bloom; if the frame rate drops it renders fewer pixels, then turns bloom off.

With `prefers-reduced-motion` the camera cuts between stops instead of flying and nothing idles. Without WebGL2 the canvas never appears and the page keeps its CSS background.

`assets/vendor/three.module.min.js` is Three.js r186, minified into one file (MIT, licence alongside). To update it:

```bash
npm pack three@<version> && tar -xzf three-<version>.tgz
echo 'export * from "./package/build/three.module.js";' > entry.js
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=none --outfile=three.module.min.js
```

## Adding a project

1. Put the media in `assets/projects/<id>/`:
   - `cover.webp`, 1280x720
   - `preview.mp4`, a 4-8 second muted loop for the card hover, ideally under 500 KB
   - screenshots, if there are any
2. Add an entry to `data/projects.json` using the fields below.
3. Set `"status": "live"` once there's something to play. Until then the project only shows in the quest log.

| Field | Notes |
| --- | --- |
| `id`, `title`, `tagline` | Required |
| `status` | `live`, `building` or `planned` |
| `skills`, `platforms` | Keys from the `skills` and `platforms` maps at the top of the file |
| `stack`, `role`, `year` | Shown in the side panel |
| `media.cover`, `media.preview`, `media.shots[]` | Paths under `assets/projects/<id>/` |
| `media.trailer` | `{ "youtube": "<video id>" }` or `{ "src": "<mp4 path>" }` |
| `build` | `{ "repo": "roadandcode/<repo>" }` for a WebGL build hosted on this site. Optional `tag` pins a release |
| `links.play` | Only for builds hosted elsewhere (itch.io and so on). Embedded in the page unless `links.embed` is `false` |
| `downloads[]` | `{ "label", "url", "size" }` for APKs and desktop zips, normally GitHub Release assets |
| `links.source`, `links.backend`, `links.api` | Repo and API docs links |
| `summary`, `highlights[]`, `metrics[]`, `architecture`, `backend`, `learned` | Page content, all optional |

## Playable builds

Every playable build is served from this site at `/play/<id>/`, but none of them are committed here. Each game repo attaches a `webgl.tar.gz` to its GitHub Release. When Vercel deploys, `tools/build.mjs` downloads the latest one for every live project that has a `build` entry and unpacks it into `dist/play/<id>/`. A game's release workflow finishes by calling this project's deploy hook, so a new tag over there shows up here without anyone touching this repo.

If a download fails the deploy fails, and Vercel keeps serving the previous version.

To try a build before releasing it, drop the Unity WebGL output into `play/<id>/` (gitignored). The local folder wins over the release.

## Media

```bash
# cover
ffmpeg -i shot.png -vf scale=1280:-1 -c:v libwebp -quality 80 cover.webp

# hover clip from a longer capture
ffmpeg -i capture.mp4 -t 6 -an -vf scale=960:-2 -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart preview.mp4
```

## Running it locally

The pages fetch `projects.json`, so they need a web server rather than `file://`:

```bash
npx serve .
```

To check exactly what Vercel will serve, build first and serve `dist/`:

```bash
node tools/build.mjs
npx serve dist
```

The Live Server extension in VS Code works too.
