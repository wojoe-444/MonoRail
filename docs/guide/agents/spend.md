---
audience: human
summary: Claude Stats charts your local agent costs by day, model and effort from logs on your computer.
---

# Keep an eye on spending

**Bots > Dashboard > Claude Stats** charts the usage logs your local agents
already write on disk so you can see where spend goes.

## What it counts

Reads local logs from Claude Code, Gemini CLI and pi, estimates per-call cost
from list prices, and refreshes every 15 minutes while MonoRail is open (or on
**Refresh**). The report is a rebuildable [cache](../glossary.md#cache) in your
[data folder](../private-data.md#where-your-data-lives). Cloud sessions (web
chats, project threads) are logged on Anthropic's servers and are not included.

## The headline number

**Cost per million output [tokens](../glossary.md#token)** (roughly 750,000
words written) normalizes usage so days and [models](../glossary.md#model) stay
easy to compare.

## What the charts show

- **Spend over time** by model.
- **Effort**: reasoning [effort](../glossary.md#effort) levels and cost.
- **Thinking share**: percentage of output spent on reasoning.
- **Session partners**: models collaborating in the same chat (e.g. a main model
  calling [subagents](create-an-agent.md)).

Every chart includes a table toggle.

## Subscription or API?

On a monthly subscription, figures represent API-equivalent cost (useful for
comparison, not your bill). Confirm or adjust your login type on the
[Claude connection](../setup/connections.md#the-connections). Enterprise logins
bill at API rates even when signing in via claude.ai.

## Spending per reply

Switch [Chat](chat.md#plain-or-detailed) to **Detailed** to inspect exact
per-call cost under every reply.

## Set a limit

Turn on a daily or monthly [spending limit](../setup/spending-limit.md) in
**Settings > General** to cap MonoRail-run turns (especially helpful on API
billing).

## Elsewhere

Home shows a summary card, and connected agents can read it via
[agent access](agent-access.md). For dbt business metrics, see
[Semantic (MetricFlow)](../data/semantic.md).
