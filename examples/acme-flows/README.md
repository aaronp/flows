# Acme — flows

**[▶ View the flows](https://aaronp.github.io/flows-example/)**

The data lives in [`flows.md`](flows.md). The UI comes from
[aaronp/flows](https://github.com/aaronp/flows).

## Using this as a template

1. Create an empty repo on GitHub, then from this directory run
   `make clone REPO=you/your-repo` (or `./clone.sh`, which prompts).
   It copies the files to `../your-repo`, points the View link above at
   your Pages site and sets the git remote.
2. Edit `flows.md` (or edit it in the viewer and use File → Download Markdown),
   then commit and push.
3. On GitHub: Settings → Pages → Source: **GitHub Actions**.
4. Optional: on the repo page, open About (⚙) → tick **Use your GitHub Pages
   website** so the link also shows in the sidebar.

The workflow deploys from `main` or `master`. "Branch … is not allowed to
deploy to github-pages"? Add your branch under Settings → Environments →
github-pages → Deployment branches and tags.

Your site redirects to the viewer with `?src=` pointing at your `flows.md`.
Any query params you add are passed on, e.g. `?flow=refund&mode=play` or
`?theme=dark`.

No Pages? Link straight to the raw file:
`https://aaronp.github.io/flows/?src=https://raw.githubusercontent.com/<you>/<repo>/<branch>/flows.md`
