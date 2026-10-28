PORT ?= 8000

.PHONY: dev build test
node_modules: package-lock.json
	npm ci
	@touch node_modules

build:
	node build.js

test: node_modules
	npm test

# Serves flows.html at / and everything else from the project, as on GitHub Pages (so ?src=examples/... works).
dev: build
	@echo "Example: http://localhost:$(PORT)/?src=examples/acme-flows/flows.md"
	@bun -e 'const s = Bun.serve({ port: $(PORT), async fetch(req) { const p = new URL(req.url).pathname; const f = Bun.file(p === "/" ? "flows.html" : "." + p); return (await f.exists()) ? new Response(f) : new Response("Not found", { status: 404 }); } }); console.log("Serving on " + s.url.href + " (Ctrl-C to stop)")'
