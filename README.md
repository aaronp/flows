# Flows prototype

Design how the participants of a system talk to each other: participants sit on a ring,
steps are drawn between them, and everything is saved as Markdown (Mermaid sequence
diagrams plus `system`, `schema`, `step` and `md` fenced blocks).

## Files

| File | What it is |
|---|---|
| `core.js` | The pure core: data model (documented at the top), Markdown parse/serialize, play timing, layout. No DOM, no I/O. |
| `ui.js` | The browser shell: rendering, input, storage. |
| `template.html` | Page markup and CSS; `/*__CORE__*/` and `/*__UI__*/` are replaced by the two scripts. |
| `flows.html` | The built page (single file). Open it in a browser. |
| `build.js` | Rebuilds `flows.html` from the three files above. |
| `core.test.js` | Self-contained `node:test` tests for the core. |
| `examples/` | Data-only repo templates that point at the published viewer. |
| `checks/` | Playwright scripts used to check the UI during development (see below). |

## Run

```sh
make test          # core tests (installs js-yaml, marked, dompurify on first run)
make build         # writes flows.html
make dev           # builds, then serves it on http://localhost:8000 (needs bun; PORT=… to change)
```

`make dev` serves `flows.html` at `/` and everything else from this folder, as on GitHub Pages,
so `http://localhost:8000/?src=examples/acme-flows/flows.md` works. You can also open
`flows.html` directly in a browser. It loads js-yaml, marked and DOMPurify from cdnjs.
Edits save automatically: to the shared store (`window.claude.db`) when the page is hosted
as a Claude artifact, otherwise to this browser's localStorage. A file opened with `?src=` is
shown on its own and not saved, so a shared link never overwrites your systems.
**File → Open…** takes a dropped or chosen `.md` file or a URL (recently opened URLs are
listed); **File → Download Markdown** saves the open system as a file.

## Address

The address bar holds what is showing, so links can be bookmarked and Back works:

| Param | Values |
|---|---|
| `src` | URL of a system's Markdown to open in place of the samples (relative to the page) |
| `system` | slug of the system to open |
| `flow` | slug of the flow to show |
| `mode` | `system`, `flow` (default), `galaxy`, `play` |
| `theme` | `light`, `dark` (default: follow the system setting) |

Older `#open-<system>--<flow>` links still open.

## Publishing

`.github/workflows/pages.yml` tests, builds and publishes the page to GitHub Pages with
`examples/` beside it. One-time setup: Settings → Pages → Source: **GitHub Actions**.

`examples/acme-flows` is a data-only repo template: just `flows.md`, a redirect to this
viewer, and its own Pages workflow. See its README (`make clone REPO=you/your-repo`).

## UI checks

The `checks/*.js` scripts drive `flows.html` with Playwright and print JSON. They expect
to run from the project folder with `node_modules` present (they serve the three libraries
from it instead of the CDN) and write screenshots to `shots/`:

```sh
npm install && npx playwright install chromium
mkdir -p shots && node checks/check19.js
```

They were written to be run from the folder they lived in, so move one up a level
(or adjust its paths) before running it.
