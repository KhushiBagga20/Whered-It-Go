# The app icon

The icon is yours to design. The repo only has a **placeholder**: a dark purple square with “W?” and “ICON TBD”, so it’s obvious when the real one is missing.

## Where to put it

```
icon-source/
  icon.png            ← your icon, 1024×1024 PNG, square, full-bleed (no rounded corners;
                        Android and iOS round it themselves)
  icon-maskable.png   ← optional, 1024×1024: the Android “adaptive” version
  placeholder.svg     ← used only while icon.png doesn’t exist
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

Rebuild and deploy. Installed phones pick up the new icon on their next update; on some Android launchers you have to remove the app and install it again.

## Maskable icon tips

Android crops the maskable icon to whatever shape the launcher uses. Keep anything important (the ₹, the grass, Khushi) inside the **central circle that covers 80%** of the width. Let the background colour run all the way to the edges.

You can check it at <https://maskable.app>. If you don’t provide `icon-maskable.png`, `icon.png` is used, so make sure that one has some breathing room.

## Where the names are wired up

- `vite.config.ts` lists the manifest icons and the long-press shortcuts.
- `index.html` has the favicon and apple-touch-icon links.

You don’t need to edit either unless you rename the files.
