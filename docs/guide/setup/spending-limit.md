---
audience: human
summary: Cap daily or monthly USD spend for MonoRail-run agent turns with early warnings.
---

# Spending limit

Set a daily and/or monthly USD cap on agent turns started by MonoRail. Off by
default in **Settings > General > Spending limit**.

## Who it is for

Best suited for per-[token](../glossary.md#token) billing (API key or Enterprise
Claude login — badged automatically from your
[Claude connection](connections.md#the-connections)). Monthly subscriptions have
no per-reply bill.

## Setting it up

1. Enable **Spending limit** in **Settings > General**.
2. Set a **daily limit** (resets midnight), **monthly limit** (resets 1st), or
   both.
3. Choose a warning threshold: 50%, 80% (default) or 90%.
4. Choose limit behavior: **Stop new turns** (default; active replies finish
   normally) or **Only warn**.
5. Click **Save** on the [Save bar](saving.md).

## What it counts

Counts replies started by MonoRail — [Chat](../agents/chat.md), the
[Coordinator](../agents/coordinator.md) and its child turns, and
`ask_coordinator` calls via [agent access](../agents/agent-access.md) — using
costs reported by Claude Code and pi once enabled.

Terminal runs, cloud sessions, and stopped or unknown-cost replies are excluded,
so treat the limit as a safety guardrail rather than an invoice (see
[Claude Stats](../agents/spend.md) for all local usage).

## In Chat

When active, Chat's status bar shows a clickable meter (e.g. `Today $21.40 /
$25`). Approaching the cap shows a yellow banner; reaching it under **Stop new
turns** pauses sending with shortcuts to **Change limit** or **Allow one more
turn**. Phone turns via [Remote access](remote-access.md) count toward the same
limit (only editable on your PC).

## Where it is kept

Settings and daily dollar totals stay in your
[data folder](../private-data.md#where-your-data-lives) — no prompts, replies or
chat titles are stored.
