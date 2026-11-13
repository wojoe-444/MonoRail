---
audience: human, ai
---

# The mochi crew

Every subagent in MonoRail gets a small character, so loops of agents are easier to follow. The characters are in the same family as the app icon, K1 Mochi: a soft dough gumdrop with dot eyes and no mouth.

To give an agent a character, [create an agent](guide/agents/create-an-agent.md): its name picks the role.

You'll see them on the **Agents** page next to each subagent definition, in **Chat** on tool rows where Claude hands work to a subagent, and on the pinned Coordinator entry. **Agents > Characters** shows the whole crew, every flavor, and lets you try a name.

## A character is a role plus a flavor

- **Role**: what the character is doing. It sets the body shape, the eyes, the headwear, the props it holds and the props on the tile behind it. There are 26 roles, from Coordinator and Planner to Journaler and Dreamer, plus a plain **Agent** for anything that doesn't match.
- **Flavor**: the colors. There are 42 flavors plus **Classic**, the app icon's own green, which only the Coordinator uses. Every role works in every flavor.

## How an agent gets its character

MonoRail reads the agent's name, then its description (`src/components/mochi/match.ts`):

1. **Role.** It goes through the words of the name from the last one back, because the main word usually comes last: `code-reviewer` becomes a Reviewer. If no word matches a role's keywords, it reads the start of the description. If that doesn't match either, the agent gets the plain Agent role.
2. **Flavor.** An agent named exactly after its role (`reviewer`) gets that role's default flavor. Any other name picks a flavor from a hash of the name, so the same agent always looks the same, and two Reviewers in one loop still look different.

Nothing is stored. The character is worked out each time it's drawn, from the name and description MonoRail already reads.

## How it's built

All of the code is in `src/components/mochi/`.

- `characters.ts`: one entry per role. Each layer is a short piece of SVG on a 256×256 canvas, drawn with the flavor's CSS variables: `--t0`/`--t1` for the tile, `--b0`/`--b1` for the dough, `--acc` for the deep accent, `--pop` for the bright accent and `--onacc` for ink on the accent. A few props keep a fixed color because they stop reading in any other: the two hard hats, the laurel and the cape.
- `flavors.ts`: each flavor is three numbers (OKLCH hue, chroma and lightness shift), and `expandFlavor()` works out every color from them. The accessory color is darkened step by step until it reaches 3:1 contrast against its own tile. Very dark tiles get a light accessory instead.
- `MochiAvatar.tsx`: `<MochiAvatar role flavor size />` draws a character, and `<AgentMochi name description />` picks the role and flavor first. Below 40 px the tile props are left out so the character stays readable.

To add a role, add an entry to `characters.ts` and its keywords to `match.ts`. To add a flavor, add one line to `FLAVORS`.
