---
audience: human, ai
summary: Every subagent automatically gets a K1 Mochi avatar (role + color flavor) derived from its name and description.
---

# The mochi crew

Every [subagent](create-an-agent.md) gets a small K1 Mochi character (a soft
dough gumdrop with dot eyes) so multi-agent runs are easy to scan at a glance.
You see them in the [Template Catalog](catalog.md), on subagent tool rows in
[Chat](chat.md), and on the pinned [Coordinator](coordinator.md). Open **Bots >
Characters** to browse the full crew and test names.

## A character is a role plus a flavor

- **Role**: body shape, eyes, headwear and props. 26 built-in roles (from
  Coordinator and Planner to Journaler and Dreamer), plus a plain **Agent**
  fallback.
- **Flavor**: color palette. 42 flavors plus **Classic** (muted sage green,
  reserved for the Coordinator), independent of your app
  [color scheme](../setup/appearance.md).

## How an agent gets its character

Derived deterministically on the fly (`src/components/mochi/match.ts`) — nothing
is stored:

1. **Role**: scans the agent's name right-to-left (`code-reviewer` -> Reviewer),
   then falls back to the start of its description, then plain Agent.
2. **Flavor**: an exact role name (`reviewer`) uses that role's default flavor;
   any other name hashes to a stable flavor so two reviewers still look
   distinct.

## How it's built

Code lives in `src/components/mochi/`:

- `characters.ts`: 256×256 SVG layers per role using flavor CSS variables
  (`--t0`/`--t1` tile, `--b0`/`--b1` dough, `--acc`, `--pop`, `--onacc`). A few
  props keep fixed colors (hard hats, laurel, cape, Coordinator halo `url(#R)`).
- `flavors.ts`: OKLCH hue/chroma/lightness triples expanded via `expandFlavor()`
  with automatic 3:1 accessory contrast adjustment.
- `MochiAvatar.tsx`: `<MochiAvatar role flavor size />` and
  `<AgentMochi name description />` (omits tile props below 40 px).

To add a role, update `characters.ts` and `match.ts`; to add a flavor, add one
entry to `FLAVORS`.
