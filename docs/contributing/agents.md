---
audience: ai
summary: Claude Stats accounting, local agent definitions and the Mochi component contract.
---

# Agent usage and catalog

See the [agent guide](../guide/agents/README.md), [Agent Chat backend](agent-chat.md)
and the [developer reference](README.md).

## Claude Stats

The [spending dashboard](../guide/agents/spend.md) shows Claude Stats as a
tab on the Agents dashboard. It remains a registered module with `nav.hidden`.
The backend bundles ccusage for Claude Code's daily API-equivalent cost, with
its native packages unpacked from the asar. `electron/modules/claude-stats-scan.cjs`
reads local Claude Code, Gemini CLI and pi logs with one reader per source.
Missing sources are reported as such. Its rows group observations by day,
session, model, role and 50K context step. It records per-turn prompt sizes,
compactions and phases (driver and subagents). A driver change or two hours
of idle time starts a new phase.

The backend combines these into the `claude-stats.usage` [cache](../caching.md):
page opens read it, a scheduler rebuilds it every 15 minutes, failures retry
after an hour and Refresh requests a rebuild. `claude-stats-prices.json`
is the shared pricing table, including prompt-size tiers, read in the
renderer by `src/modules/claude-stats/pricing.ts`. A test checks that logged
models have a row. The pricing facts in `facts.ts` scale Claude Code rows to
ccusage's totals per day and model, use pi's logged cost as-is and price
other rows from the table. Label unlogged cost splits as estimates.

Claude stores effort on responses and thinking counts at
`output_tokens_details.thinking_tokens`. pi records `thinking_level_change`
along the branch. Estimate its thinking counts from text at about four
characters per token and mark them with `~`. Gemini logs thinking under
`thoughts`. `effort.ts` and `components/EffortCards.tsx` chart the mix over
time, unit costs and thinking share. Use one hue in steps for ordered
levels and Other grey for "Not logged". Only sessions with local logs count.
The page explains the cloud coverage limit. Use the
[Claude connection](connections.md#accounts-and-local-tooling) billing type
for Subscription/API/Enterprise context.

## Agent overview and definitions

`/agents` (`src/pages/agents/`) reuses Chat's session list, composer data
and active turns, and reads the Claude Stats summary without rebuilding the
report. `electron/modules/agents.cjs` keeps no files. Its
`agents-definitions.cjs` reads Claude subagents in `.claude/agents` and skills
in `.claude/skills/*/SKILL.md`, plus pi subagents and skills in `.pi/agents`
and `.pi/skills` under each allowed repo. User-level definitions also come
from the home directories (pi uses `~/.pi/agent/`). List only front matter.
Fetch definition bodies by id on demand. Leave archived chats out. Quick
launch uses `openInChat()` (`src/modules/agent-chat/handoff.ts`) in memory
and prefills the composer without sending the prompt.

## Agent Catalog

The [Agent Catalog](../guide/agents/catalog.md) discovers Claude Code subagents (`~/.claude/agents`,
`<repo>/.claude/agents`) and pi subagents (`~/.pi/agent/agents`,
`<repo>/.pi/agents`, the files pi's subagent extension reads) from the home
folder and Chat's allowed repos, plus the built-in coordinator (read-only,
"Make my own copy"), and built-ins from `agent-catalog-builtins.cjs` (Storage
Detective: look-only tools plus the MCP `storage_scan` read tool, a prompt that
never deletes or moves; "Add to Claude Code" copies it to `~/.claude/agents`;
the browser sample must carry the same text, a test checks). A plain-language explainer per subagent
(`src/modules/agent-catalog/explain.ts`: tools in words, strength, "It
cannot") and create / edit / duplicate / delete
(`electron/modules/agent-catalog.cjs`). The page names subagents by id and a
save place as `user` or an allowed repo's name, never a path; the agents
folder must resolve inside its base; edits refuse a file changed on disk since
it was opened and never touch a linked file; unknown header fields are kept.
Every edit or delete first copies the file to `backups/` in the module's data
folder (newest 200). Nothing is cached.

## Mochi crew

The [Mochi crew](../guide/agents/mochi-crew.md) (`src/components/mochi/`) are agent
characters in the K1 Mochi app-icon family (dough body, dot eyes, never a
mouth, never a robot). A character is a role (layers of static SVG in
`characters.ts`: body, eyes, headwear, held props, tile props) times a flavor
(`flavors.ts`: flavors of three OKLCH numbers each, expanded with a 3:1
accessory contrast check; `Classic` is the icon's own palette and belongs to
the Coordinator). Layers use only the flavor's CSS variables, except the fixed
props listed in the docs. `AgentMochi` picks the role from the name (last word
first) and then the description (`match.ts`), and the flavor from the role
default or a hash of the name. Nothing is stored. The SVG is inserted as
markup, so only repo-authored strings may go into it, never agent or user text.
Shown on Agents definitions, Chat's Agent/Task tool rows and the Coordinator
entry; Agents > Characters is the gallery.
