# The app icon

The icon is `icon-source/icon.png`. Everything in `public/icons/` is built from it; don’t edit those files by hand.

## Where to put it

```
icon-source/
  icon.png            ← your icon, 1024×1024 PNG, square, full-bleed (no rounded corners;
                        Android and iOS round it themselves)
  icon-maskable.png   ← optional, 1024×1024: a hand-made Android “adaptive” version
  placeholder.svg     ← a “W? / ICON TBD” stand-in, used only if icon.png is missing
```

Then run:

```bash
npm run icons
```

That writes every size the app uses into `public/icons/`:

| File | Size | Used for |
| --- | --- | --- |
| `icon-192.png` | 192 | Android home screen, install prompt |
| `icon-512.png` | 512 | Android splash screen, install prompt |
| `icon-maskable-512.png` | 512 | Android adaptive icon (circle, squircle…) |
| `apple-touch-icon.png` | 180 | iPhone / iPad home screen (made opaque) |
| `favicon-32.png`, `favicon-64.png` | 32, 64 | browser tab |

It also writes `src/assets/logo.webp`, the small logo inside the app (header, login, splash). That one keeps only the central 86% of the icon, so the drawing is bigger at 34px; nothing but empty margin is trimmed.

Rebuild and deploy. Installed phones pick up the new icon on their next update; on some Android launchers you have to remove the app and install it again.

## Maskable icon tips

Android crops the maskable icon to whatever shape the launcher uses, and only guarantees the **central circle that covers 80%** of the width.

By default you don’t need to do anything: `npm run icons` shrinks `icon.png` to 86% and centres it on the icon’s own background colour (taken from its top-left corner), which keeps the whole drawing inside that circle. This works because the icon has a flat background.

If you’d rather draw the adaptive version yourself, save it as `icon-source/icon-maskable.png`: background running to the edges, everything important inside the central 80% circle. You can check it at <https://maskable.app>.

The splash screen uses `background_color` in `vite.config.ts`. Keep it equal to the icon’s background (the script prints the colour) so no square shows around the icon while the app opens.

## Where the names are wired up

- `vite.config.ts` lists the manifest icons and the long-press shortcuts.
- `index.html` has the favicon and apple-touch-icon links.

You don’t need to edit either unless you rename the files.
