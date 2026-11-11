---
audience: human
summary: Claude Stats charts what your agents cost, by day, model and effort, from logs on your computer.
---

# Keep an eye on spending

**Insights > Claude Stats** turns the usage logs your agents already write on
this computer into charts, so you can see where the money goes.

## What it counts

Claude Code, Gemini CLI and pi each keep a log of every conversation on your
computer. Claude Stats reads them, works out the cost of each
[model](../glossary.md#model) call from list prices, and builds a report. It
refreshes every 15 minutes while MonoRail is open, or when you press
**Refresh**. The report is a [cache](../glossary.md#cache) MonoRail can
always rebuild, kept in your [data folder](../private-data.md#where-your-data-lives).

Conversations that run in the cloud (Claude on the web, project threads) keep
their logs on Anthropic's servers, so they are not counted. The page says so
too.

## The headline number

The big figure is **cost per million output [tokens](../glossary.md#token)**:
what you pay for every million tokens (roughly 750,000 words) your agents
write. It makes days and models comparable even when you used them very
differently.

## What the charts show

- **Spend over time**, by model.
- **Effort**: how hard the models were asked to think
  ([effort](../glossary.md#effort)), and what that cost.
- **Thinking share**: how much of the output was the model's own reasoning.
- **Session partners**: which models work together in the same chat, for
  example a big model directing smaller [subagents](create-an-agent.md).

Every chart has a table view beside it.

## Subscription or API?

If you pay a monthly subscription, the costs shown are what the same use
would have cost at API prices: useful for comparing, not a bill. The badge at
the top says which kind of login MonoRail thinks you have; change it on the
[Claude connection](../setup/connections.md#the-connections). Enterprise
logins are billed at API prices even though you sign in through claude.ai.

## Spending per reply

For a single conversation, switch [Chat](chat.md#plain-or-detailed) to
**Detailed**: each reply then shows what every model call cost.

## Set a limit

To cap what agents started from MonoRail can spend each day or month, turn
on the [spending limit](../setup/spending-limit.md) in Settings. It is off
by default, and most useful when your login is billed at API prices.

## Elsewhere

Home shows a small summary of the same report. Agents can read it too,
through [agent access](agent-access.md).
