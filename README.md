# Bhargavi's Makeup Doll

A client-only touch game. No backend, account, advertisements, analytics, or external game links. Production: https://bhargavi-makeup-doll-v1.vercel.app

## Playing

Choose Bhargavi, Tara, Meera, or Pari from the four picture cards. Each has a different face, skin tone and default hairstyle. Switching dolls preserves each doll’s makeup, dress, hairstyle and accessories for this play session. Reset clears only the selected doll. Reloading starts a fresh session.

Select a makeup tool and shade, then rub her lips, cheeks, or eyelids. Drag clothes, hairstyles, accessories, and food onto their matching body areas. Hold a lollipop at the mouth for repeated licks. Drag the doll's body horizontally to spin. Selecting a makeup tool returns her to the front.

## Audit and fixes

The previous app crashed at `$('.tool-card').forEach(...)`: `$` returns one element. Execution stopped before wiring the tabs and actions. Dragging, painting, and spinning also had independent flags and incomplete capture cleanup. Blush and shadow changed both sides globally. The previous worker did not populate an offline cache; the manifest only provided an SVG icon.

The replacement uses one gesture record: idle, makeup, dragging-dress, dragging-hair, dragging-accessory, dragging-food, or rotating. All pointer movement/end/cancellation goes through shared handlers. Capture is released before changing UI. Tab changes, reset, lost capture, blur, and hidden-document transitions cancel active gestures. Only scene and drag cards use `touch-action: none`; controls use `manipulation`.

A shared control activation handler uses pointer-up for touch/mouse and native zero-detail click for keyboard/accessibility activation. Chrome touch emulation reproduced a missing synthetic click immediately after dragging; this avoids that dependency without double activation. Painting and drag starts exclusively use Pointer Events.

Makeup accumulates inside SVG clipping masks. Lipstick retains local continuous strokes; blush and shadow accumulate translucent dabs independently on each side. Hit tolerance projects a nearby finger position onto the region while preserving the visible clip. Dresses and hair have actual SVG item previews. Drop targets are calculated in SVG coordinates using the screen matrix. Invalid drops leave appearance unchanged; valid drops animate. Food animates the mouth and uses soft synthesized audio. Lollipops repeat while held and remain available afterwards.

Rotation crossfades front, right profile, back, and mirrored left profile. It is a sprite approximation, not a true 3D model. Existing front/back doll art and hairstyle choices are preserved.

## PWA

192px and 512px opaque PNG icons, standalone manifest, native install prompt when offered, and Chrome-menu fallback. `bhargavi-shell-v10` caches the offline shell. Same-origin requests are network-first with no-store; offline requests fall back to cache. Updates delete only old Bhargavi caches, activate immediately, and reload an existing app at an idle point. The existing Vercel no-store headers for HTML, JS, CSS, manifest, and service worker are retained.

## Testing

Install Playwright as a development dependency and its Chromium browser, serve the repository, then run:

```sh
npm install --no-save playwright
npx playwright install chromium
python -m http.server 3000
# In another terminal:
node tests/game.cjs http://127.0.0.1:3000
node tests/game.cjs https://bhargavi-makeup-doll-v1.vercel.app
```

The test also exercises makeup, dress, hair, accessories, feeding and rotation on all four dolls, restoration of separate makeovers, reset isolation and a second-finger doll switch during painting.

The test runs desktop 1100x900 and mobile 360x800 with real Chromium CDP touch input. It covers the requested 20-step sequence, all item types, invalid drops, shade selection, repeated tabs, cancellation, second-finger interaction, rotation followed by painting, reset, sound controls, keyboard activation, install fallback, Chrome installability errors, manifest/cache contents, offline reload, console errors, and horizontal overflow.

Emulation does not replace a physical Android installation or audible sound check. OS emoji artwork can differ. First online loading is required before offline play. Dress/hair/accessory dragging is touch/mouse gameplay; keyboard can activate controls but does not position drag items.
