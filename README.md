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
| `checks/` | Playwright scripts used to check the UI during development (see below). |

## Run

```sh
npm install        # js-yaml, marked, dompurify (the tests need js-yaml)
npm test           # core tests
npm run build      # writes flows.html
```

Open `flows.html` directly in a browser. It loads js-yaml, marked and DOMPurify from
cdnjs. Saving to the shared store (`window.claude.db`) only works when the page is hosted
as a Claude artifact; elsewhere it runs on the built-in sample and says "Not saved". Use
**File → Download Markdown / Open file** to keep your work.

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
