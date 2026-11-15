# Verification

- 2026-11-09: TypeScript `npx tsc --noEmit` passed before final visual styling.
- Vinext production build passed.
- `node --experimental-transform-types --test tests/server-game.test.ts`: 8 tests passed, covering rule enforcement, special moves, repetition, expiry, authorization, and concurrent/idempotent writes.
- Managed preview with real D1 migration applied. The browser network harness (`preview-browser-harness.tsx`, temporarily mounted at `/qa` and removed before publication) PASS: two independently retained bearer clients; create, join, rejoin, third-client spectator; e2-e4 and e7-e5; illegal moves and out-of-turn requests rejected; duplicate request idempotent; stale revision rejected; GET reload retains roles/history; no secrets in public state; resignation synchronized.
- Browser UI: e2 highlighted e3/e4, e2-e4 updated piece and move history, online room creation produced invitation link.
- WebGL visual verification is unavailable in the managed cloud browser: its graphics vendor and renderer are Disabled. Automatic accessible 2D fallback was observed. This is an environment limit, not a passed 3D visual test.
- Remote publication and final visual/mobile checks pending.
- 390px viewport tested in a same-origin iframe. Board fits without horizontal overflow, controls remain visible, e2-e4 works.
- Added navigation/race guards, storage-failure warning, request timeout, pre-saved client seat secret for lost-join-response recovery. Nine backend tests now pass. Added custom SVG 2D pieces (no emoji color ambiguity).
