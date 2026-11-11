---
audience: human
summary: Claude Stats charts what your agents cost, by day, model and effort, from logs on your computer.
---

# Keep an eye on spending

**Insights > Claude Stats** turns the usage logs your agents already write on
this computer into charts, so you can see where the money goes.

## What it counts

Claude Code, Gemini CLI and pi each keep a log of every conversation on your
computer. Claude Stats reads them, works out the cost of each model call from
list prices, and builds a report. It refreshes every 15 minutes while
MonoRail is open, or when you press **Refresh**.

Conversations that run in the cloud (Claude on the web, project threads)
keep their logs on Anthropic's servers, so they are not counted. The page
says so too.

## The headline number

The big figure is **cost per million output tokens**: how much you pay for
every million tokens (roughly 750,000 words) your agents write. It makes
days and models comparable even when you used them very differently.

## What the charts show

- **Spend over time**, by model.
- **Effort**: how hard the models were asked to think, and what that cost.
- **Thinking share**: how much of the output was the model's own reasoning.
- **Session partners**: which models work together in the same session.

Every chart has a table view beside it.

## Subscription or API?

If you pay a monthly subscription, the costs shown are what the same use
would have cost at API prices, which is useful for comparing, not a bill.
The badge at the top says which kind of login MonoRail thinks you have; you
can change it on **Connections**.

## On the home page

Home shows a small summary of the same report, without building a new one.
