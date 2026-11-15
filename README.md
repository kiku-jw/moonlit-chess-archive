# Moonlit Chess — archived experiment

Development is discontinued. This repository preserves the existing «Лунный гамбит» experiment, not a released iOS app or a newly maintained chess service.

- `docs/`: dependency-free static showcase suitable for GitHub Pages, including the original SVG piece designs. It is explicitly not playable.
- `source/`: sanitized source from the previously deployed Site commit `4f5e41d2881efc8c7effb6700b45af5a80828307`. Procedural Three.js geometry, browser-local play, room-server source, SQLite/D1 schema and original tests are retained.
- `SOURCE-MANIFEST.json`: original copied-file hashes and explicit omissions.

The online mode requires a Cloudflare Worker and D1 database; GitHub Pages supplies neither. The archived source is not connected to a substitute server. No real room records, account data, environment files, credentials or private Git history are published.

The optional `garden.png` scenery is omitted because its provenance was not established in this archive pass. The authored procedural 3D geometry and SVG piece paths are retained. Existing third-party notices remain beside vendored files; dependency declarations and the lockfile preserve package identities. No new blanket license is asserted for original work.

Later 11 November UI and geometry experiments are separate unpublished drafts. They are not silently represented by this deployed snapshot. The canonical task retains their recovery references and limitations. Native iOS, physical-device acceptance and final art quality were not completed.

## GitHub Pages

Publish branch `main`, directory `/docs`. The showcase uses relative local assets and no build step, external fonts, scripts, accounts or service credentials. Preserve this repository and Pages after archiving development. No continued support or updates are promised.

The historical source README describes the old starter build workflow; it does not prove current dependency compatibility or a live backend. This archive pass does not install dependencies, create accounts or replay model/Tripo experiments.
