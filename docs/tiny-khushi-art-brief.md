# Tiny Khushi: art brief

Everything the app can show of her, how big she appears, and how to drop the drawings in.

## The short version

- **25 drawings**: 8 faces × 3 poses (sit, peek, stand), plus one waving drawing.
- **Minimum to go live with your art: 3** — `sit-neutral`, `peek-neutral`, `stand-neutral`. Any face you haven’t drawn yet falls back to that pose’s neutral drawing, so she’s never missing.
- Put the files in [`src/assets/mascot/`](../src/assets/mascot/), named `pose-face.webp`. No code changes.
- Check them at **`/mascot`** while running `npm run dev` (Settings → Tiny Khushi → *See all her faces*). In dev it says which are drawn, which are falling back, and which are still the placeholder.

## The poses

| Pose | Canvas (w × h) | Template | Where she appears | How big on screen |
| --- | --- | --- | --- | --- |
| `sit` | 480 × 720 | [sit-template.png](mascot-templates/sit-template.png) | On the hill above the nav, on the donut chart, beside the Money total, loading screen | 50–64 px tall |
| `peek` | 720 × 600 | [peek-template.png](mascot-templates/peek-template.png) | Over the top of the Calendar, over the add-transaction sheet | 52–58 px tall |
| `stand` | 480 × 720 | [stand-template.png](mascot-templates/stand-template.png) | Empty states, the error screen, the desktop side panel | 64–132 px tall |
| `wave` | 540 × 720 | [wave-template.png](mascot-templates/wave-template.png) | Sign-in and onboarding (“hi. i’m tiny khushi.”) | 110–120 px tall |

- **sit**: she’s sitting on a ledge. Her bottom rests on the pink line in the template; legs hang over it (knees bent looks great). Everything below that line dangles into empty space.
- **peek**: only her head and two hands, gripping an edge (the pink line). Anything below the line is hidden behind the calendar or sheet, so leave it empty.
- **stand / wave**: feet touch the bottom edge of the canvas. Wave = one arm up, happy face only.

You can draw bigger (2× the canvas is great) as long as the proportions match. The app shrinks it.

## The faces

Draw each of these for `sit`, `peek` and `stand`:

| Face | What it looks like (placeholder) | When the app uses it |
| --- | --- | --- |
| `neutral` | Resting face, open eyes, small closed smile | Default. Small spends: “acceptable.” When he pokes her |
| `judging` | Half-lidded eyes, one eyebrow up, flat mouth | ₹150–₹1,500: “hmm.” / “bro.” Subscriptions. Her resting face on the chart |
| `suspicious` | Side-eye, brows angled in, wobbly mouth | Shopping: “interesting.” Food again: “you again?” Deleting/editing. Empty states |
| `shocked` | Huge round eyes, raised brows, little “o” mouth | ₹1,500+: “WHERE’D IT GO?” Error screen. While typing a big amount |
| `happy` | ^ ^ eyes, open smile | Money coming in: “oh look who’s rich now.” Greetings |
| `proud` | Closed happy eyes, smug one-sided smile | No-spend streaks: “character development?” College spends |
| `love` | Heart eyes, open smile | Gifts: “is this for me?” Big income. Health spends |
| `sleepy` | Droopy closed eyes, tiny “o”, no brows | Loading screen, late-night check-ins, “Nobody paid you. Tragic.” |

Plus `wave-happy`. The face descriptions are just what the placeholder does; your versions can be anything.

**Full file list (25):**

```
sit-neutral    sit-judging    sit-suspicious    sit-shocked    sit-happy    sit-proud    sit-love    sit-sleepy
peek-neutral   peek-judging   peek-suspicious   peek-shocked   peek-happy   peek-proud   peek-love   peek-sleepy
stand-neutral  stand-judging  stand-suspicious  stand-shocked  stand-happy  stand-proud  stand-love  stand-sleepy
wave-happy
```

## Suggested order

1. `sit-neutral`, `peek-neutral`, `stand-neutral` (the three fallbacks)
2. `sit-judging`, `sit-shocked`, `sit-happy`, `sit-suspicious` — she’s sitting most of the time
3. `peek-shocked`, `peek-judging`, `peek-suspicious`, `peek-happy`, `peek-love` — she reacts live while he types an amount
4. `stand-suspicious`, `stand-proud`, `stand-sleepy`, `stand-shocked`, `wave-happy`
5. Everything else

## Rules that make it look right in the app

- **Transparent background.** WebP (or PNG), under ~40 KB each (WebP quality ~85 is plenty).
- **Same body, same head position for every face in a pose.** The app swaps faces in place (e.g. while he’s typing an amount she goes neutral → suspicious → shocked), so if the head moves between files she’ll jump. Easiest: draw the body once per pose and only change the face layer.
- **A light outline around her** (a “sticker” border, ~6–8 px at canvas size, cream `#FFF6EA` or white). She sits on a dark purple sky and neon green grass; without it she disappears. The placeholder has one.
- **Thick lines, big face.** On the hill she’s only ~50 px tall. Zoom your canvas out to thumbnail size and check the expression still reads. Thin details vanish.
- **Keep her inside the dashed margin** in the templates, so the outline isn’t clipped.
- **Don’t draw:** speech bubbles, a shadow, the ground, or motion lines. The app adds bubbles and does all the movement (hop, shake, nod, spin, faint, a gentle bob).

## Optional extras

- **Blinks:** for any drawing with open eyes, add the same drawing with eyes closed, named with `-blink` (e.g. `sit-neutral-blink.webp`). She’ll blink every few seconds.
- **Colours:** nothing in the code depends on her outfit colours. The placeholder uses the app palette (orange top, pink flower clip, purple trousers) so she belongs in the meadow, but it’s your call.

## Adding them

1. Export to `src/assets/mascot/` with the exact names above (lowercase).
2. `npm run dev` → open `/mascot` and check each one in place, at real size.
3. Commit and push. Vercel rebuilds, and the service worker ships the new art to the installed app on its next launch.

The templates (SVG + PNG) are in [`docs/mascot-templates/`](mascot-templates/). Import the PNG as a reference layer, draw on a new layer, and hide the template before exporting.
