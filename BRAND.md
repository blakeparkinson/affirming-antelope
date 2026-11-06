# Affirming Antelope brand guide

## Brand idea

Affirming Antelope helps practitioners rehearse Motivational Interviewing until the skills feel natural. The brand should feel encouraging, alert, capable, and warm. It is playful without feeling juvenile.

## Logo

The primary mark is the deep-brown cartoon mascot head in `apps/web/public/brand-logo-deep.svg`. It preserves the mascot’s eyes, smile, ears, tuft, and horns while removing body details for small-size clarity.

- Use the full-color SVG on white or pale periwinkle.
- Use `public/brand-logo-mono.svg` when only one color is available.
- Horizontal lockups: `apps/web/public/brand-lockup-horizontal-deep.svg` and `public/brand-lockup-horizontal-inverse.svg`.
- Stacked lockups: `apps/web/public/brand-lockup-stacked-deep.svg` and `public/brand-lockup-stacked-inverse.svg`.
- Keep clear space around the mark equal to half the height of an ear.
- Minimum digital height: 24px.
- Do not rotate, outline, recolor, stretch, or place the mark over detailed imagery.
- Pair the mark with the Fredoka 700 wordmark. Set `Affirming Antelope` with normal case and tight optical spacing.

The editable drawing master is the [Affirming Antelope brand master](https://www.figma.com/design/rjmmfYCokb7HERrSFsABJj). The production color treatment is the deep-brown artwork generated in this repository; the original caramel exports are retained as inputs, not approved display alternatives.

## App icons

- Browser favicon: `src/app/favicon.ico`
- General app icon: `src/app/icon.png`
- Apple touch icon: `src/app/apple-icon.png`

The app icon uses a pale periwinkle field so the navy and ochre mark remains distinct at small sizes.

## Character

The mascot is the expressive version of the antelope character. `apps/web/public/brand-character-sheet.png` is the drawing and proportion reference. The transparent `-deep.png` poses are the production color reference, including on the studio site and merchandise.

- Default pose: `apps/web/public/brand-mascot-wave-cartoon-deep.png`
- Celebration pose: `apps/web/public/brand-mascot-celebrate-cartoon-deep.png`
- New poses must match the character sheet’s oversized head, compact body, palette, neckerchief, facial proportions, and rounded outline system.
- Keep the expressive eyes, soft horns, near-black navy details, rich brown body, cream muzzle and belly, and deep blue neckerchief consistent.
- Use the mascot for guidance, encouragement, completion, and empty states.
- Do not use the mascot as decoration when it does not communicate something.
- Do not add human clothing or anatomy. Do not mix these illustrations with glossy 3D or photorealistic antelope artwork.

## Production artwork (updated 2026-11-06)

Use the existing deep artwork directly. Never deepen an already deep image or recolor it to the UI's ochre token.

| Placement | Production asset / source |
| --- | --- |
| Logo and structured metadata | `apps/web/public/brand-logo-deep.svg` / `brand-logo-deep.png` |
| Horizontal / stacked full-color lockup | `apps/web/public/brand-lockup-{horizontal,stacked}-deep.svg` |
| Coaching still / celebration | `apps/web/public/brand-mascot-{wave,celebrate}-cartoon-deep.png` |
| Marketing coaching placements | `apps/web/src/lib/mascot-art.ts` |
| App icons / social previews | Existing generated fixed-name files; already use the deep treatment |
| Mobile coach | Generated Rive coach and `assets/mascot/rig/`; both already use the deep treatment |
| Prime Menagerie site | `npm run brand:sync -- antelope . ../affirming-antelope` from the studio repo |
| Merchandise | Embed the deep PNG directly, preserving its transparency and proportions |

`apps/web/scripts/mascot-deepen.py` generates the deep stills, marks, icons and preview images from untouched originals. The WebGL hero intentionally consumes the original texture because its shader applies the same treatment at render time. The mobile rig and Rive pipelines also own their color conversion. Do not substitute a deep source into these conversion steps: that would darken the character twice.

The monochrome and inverse lockups remain single-color treatments. Do not use an old caramel full-color export as an inverse treatment.

## Color

- Cobalt: `#4F6BED` for primary actions and active learning states.
- Deep cobalt: `#374FBF` for pressed states and wordmark accents.
- Navy: `#0A284E` for the logo, illustration contours, and dark brand applications.
- Ochre: `#E8A638` for achievement and emphasis in the interface. The mascot uses the separate deep-brown production artwork; this token is not its fur color.
- Pale periwinkle: `#EEF1FF` for learning surfaces.
- Ink: `#2E3448` for primary text. A cool near-navy so text sits with the periwinkle surfaces.
- Muted: `#68708C` for secondary text (4.9:1 on white, 4.4:1 on pale periwinkle; use ink for small text on periwinkle).
- White: `#FFFFFF` for the page and raised surfaces.

Use cobalt as the primary UI color. Ochre is an accent, not a second call-to-action color.

## Typography

- Display and wordmark: Fredoka 600-700.
- Body and interface: Nunito 600-900.
- Use sentence case for headings and labels.
- Reserve all caps for short primary action labels.

## Shape and depth

- Standard surface radius: 20px.
- Large illustration radius: 32px.
- Standard border: 2px.
- Raised surfaces sit on a solid bottom shadow in the related darker token. The depth scale is 3 (small: learner bubble, compact controls), 4 (medium: choice tiles, medium buttons), 5 (large: standard surfaces, large buttons, bubbles) and 6 (extra large: hero cards). Mobile tokens: `depth.sm/md/lg/xl`; web: `--depth-sm/md/lg/xl`.
- Interactive controls lose their bottom shadow and move down when pressed.

## Voice

Write like a thoughtful coach: direct, specific, and encouraging.

- Prefer: “Practice better conversations.”
- Prefer: “One short drill.”
- Avoid exaggerated promises, clinical jargon, and generic productivity language.
- Keep the focus on rehearsal, noticing habits, and returning to real conversations.

## Name clearance

A preliminary exact-name web search on August 31, 2026 found no obvious active product or company using “Affirming Antelope.” This is not a legal trademark clearance. Complete a formal search in the intended countries and classes before filing or investing in a large print run.
