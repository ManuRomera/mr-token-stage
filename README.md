# MR Token Stage

**Scale · Style · Focus · Perform**

MR Token Stage turns Foundry VTT token manipulation into a fast visual staging workflow. It is system-agnostic and designed for **Foundry VTT v13 and v14 from a single module**.

## Why it exists

It began as a tiny macro that kept a token on a 1×1 logical base while scaling its artwork. The module expands that idea into a complete token visual director: change visual scale without changing occupied squares, fix PNG framing, mirror artwork, humanize crowds, focus the table on a character, save reusable looks, and undo safely.

## Highlights

- Visual scale independent from logical token footprint.
- Multi-token editing.
- Scale presets from ×0.25 to ×8 and custom presets.
- Independent texture X/Y offset, texture rotation and token opacity.
- Horizontal and vertical flip.
- Humanize groups with subtle scale, facing and rotation variance.
- Focus and Spotlight modes for narrative scenes.
- Copy/paste appearance between tokens.
- Equalize selected token scales.
- Scenic Token preset: 1×1 base, hidden name/bars and locked rotation.
- Original-state restore and 30-step session undo history.
- Floating compact UI that remembers size and position per user.
- Hover help, keyboard-friendly controls, large UI and high-contrast options.
- Spanish and English localization foundation.
- Public macro/API surface: `game.mrTokenStage`.
- **Token drag distance ruler hidden by default.**
- **Token facing preserved during movement by default.**
- Both movement behaviors are configurable world settings.
- System-agnostic, no dependencies.

## Installation

Once the first GitHub release exists, install using:

`https://github.com/ManuRomera/mr-token-stage/releases/latest/download/module.json`

Or download `mr-token-stage.zip`, extract it into Foundry's `Data/modules/` directory, and enable **MR Token Stage** in your world.

## Quick use

### Integrated left toolbar

MR Token Stage has its **own Scene Controls icon** in Foundry's left toolbar (the theatre masks icon). Click it to reveal quick actions:

- Open the full MR Token Stage panel.
- Visual scale +10% / -10%.
- Humanize group.
- Focus / Spotlight / Clear Focus.
- Scenic Token.
- Undo.
- Restore original appearance.


1. Select one or more tokens.
2. Open **Token Controls → MR Token Stage**.
3. Apply scale, framing, a preset or a scene-direction action.
4. Use **Undo** to reverse the latest module operation.
5. Use **Original** after **Scenic** to recover the stored pre-scenic appearance.

## Movement defaults

Two world settings are intentionally enabled on first install:

- **Hide ruler while moving tokens** — suppresses Foundry's token drag ruler/distance line.
- **Preserve facing while moving** — prevents movement from auto-rotating token artwork.

They can be disabled independently in Module Settings.

## Macro/API examples

```js
// Visual scale ×3 for selected tokens
await game.mrTokenStage.scale(3);

// Increase each selected token by 10% relative to its current scale
await game.mrTokenStage.scale(1.1, { relative: true });

// Flip selected tokens horizontally
await game.mrTokenStage.flip("x");

// Humanize a crowd
await game.mrTokenStage.humanize(0.10);

// Apply the built-in boss preset
await game.mrTokenStage.applyPreset("boss");

// Direct attention
await game.mrTokenStage.focus();
```

## Compatibility philosophy

MR Token Stage stores only its own state in module flags/settings and applies focused TokenDocument updates. It does not alter actor data, token position, vision, light, elevation or game-system data when applying appearance controls.

The drag-ruler suppression wraps Foundry's ruler visibility behavior rather than replacing token movement. Some game systems and movement modules may also customize token-ruler behavior; if a conflict appears, disable **Hide ruler while moving tokens** and let the specialized movement module control it.

## Accessibility

- Never relies on color alone for control meaning.
- Icons include text labels in primary actions.
- Focus-visible outlines.
- Large UI option.
- High-contrast option.
- Reduced-motion support.
- Optional contextual hover help.

## AI disclosure

This project was developed with AI-assisted coding and design support under the direction and review of Manuel Romera.

## License

MIT © 2026 Manuel Romera Chinchilla.
