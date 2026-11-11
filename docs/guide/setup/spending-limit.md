---
audience: human
summary: Turn on a daily or monthly spending limit for the agent turns MonoRail runs, with a warning before you reach it.
---

# Spending limit

If your Claude login is billed at API prices, every reply an agent writes
costs money. The spending limit lets you cap what MonoRail itself spends.
It is **off** until you turn it on in **Settings > General > Spending limit**. While it
is off, nothing is counted and nothing changes.

## Who it is for

Most useful when your Claude login pays per [token](../glossary.md#token):
an API key, or an Enterprise login, which bills at API prices even though you
sign in through claude.ai. The card shows a badge when the
[Claude connection](connections.md#the-connections) says yours is billed
that way. With a monthly subscription there is no bill per reply, so you
probably don't need it.

## Setting it up

1. Open **Settings > General** and turn on **Spending limit**.
2. Enter a **daily limit**, a **monthly limit**, or both. Leave a field
   empty for no limit. The daily limit resets at midnight, the monthly one on
   the 1st.
3. Pick when to be warned: at 50%, 80% (the default) or 90% of a limit.
4. Pick what happens at the limit:
   - **Stop new turns** (the default): agents can't start a new reply until
     the limit resets. A reply that is already running is never cut off.
   - **Only warn**: replies still run, and Chat shows that the limit is
     reached.

The card shows what has been spent today and this month.

## What it counts

It counts every reply MonoRail runs: in [Chat](../agents/chat.md), by the
[coordinator](../agents/coordinator.md) and the chats it messages, and the
coordinator turns other agents start through
[agent access](../agents/agent-access.md). It uses the cost Claude Code and
pi report for each reply, and starts counting when you turn the limit on.

It doesn't count agents you run yourself in a terminal, or cloud sessions.
[Claude Stats](../agents/spend.md) shows all of your agents' spending on this
computer. Sometimes the cost of a reply isn't known, for example the first
reply in a terminal chat you continue in MonoRail, or a Claude reply you
stop. Those replies aren't counted, so treat the limit as a guide, not a
bill.

## In Chat

While the limit is on, Chat's status bar shows a small meter, for example
"Today $21.40 / $25". Click it to open Settings. Near the limit, a yellow
note above the message box says how much is used. At the limit, with
**Stop new turns**, sending is paused and the note offers two ways on:

- **Change limit** opens Settings.
- **Allow one more turn** lets exactly one more reply start.

## Where it is kept

The settings and one dollar total per day stay in your
[data folder](../private-data.md#where-your-data-lives) on this computer.
No prompts, replies or chat names are stored.
