# roadandcode.vercel.app

My portfolio site, hosted on Vercel. Plain HTML, CSS and JavaScript with no framework. The only build step collects the playable WebGL builds.

## How it's put together

- `index.html` is the home page. Hero, skills, experience, about and contact are written straight into the HTML.
- `project.html` is one template for every project page, opened as `project.html?id=<id>`.
- `data/projects.json` holds every project. The grid, the filters, the quest log and the project pages are all rendered from it.
- `assets/js/hero.js` is the contour-map shader behind the hero (WebGL2, with a CSS gradient as the fallback).
- `tools/build.mjs` assembles `dist/` for deployment: the pages above plus each project's WebGL build under `play/<id>/`.

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
