---
audience: human
summary: The words used around MonoRail and AI agents, in plain language, each with a link to where it matters.
---

# Glossary

Plain explanations of the words used across this wiki. Each one links to the
page where it matters most.

## Agent

An AI program that can do work for you, not only chat: read files, run
commands, make changes. Claude Code and pi are agents. You talk to them in
[Chat](agents/chat.md).

## Subagent

A helper agent with its own instructions and tools that a main agent hands a
task to. [Create an agent](agents/create-an-agent.md) shows how to write one,
and the [mochi crew](../mochi-crew.md) gives each one a face.

## Skill

A set of written instructions an agent follows when the task fits, without
tools of its own. See [skills](agents/create-an-agent.md#skills).

## Coordinator

A special chat that talks to your other chats for you. See
[the Coordinator](agents/coordinator.md).

## Chat

One conversation with an agent, from first message to last. Also called a
session. See [Chat with your agents](agents/chat.md).

## Model

The AI that does the thinking, such as Claude Opus, Sonnet or Haiku. Bigger
models are smarter and cost more. [Keep an eye on spending](agents/spend.md)
compares them.

## Token

The unit models read and write in, roughly three quarters of a word. Prices
are per million tokens, which is why [Claude Stats](agents/spend.md#the-headline-number)
measures cost per million output tokens.

## Input and output

What is sent to the model, and what it writes back. Output costs more per
token.

## Cache

Text a model has seen recently is kept for a while, so sending it again is
cheaper. MonoRail also keeps caches of its own, such as the spending report,
and can always rebuild them; see [Caching in MonoRail](../caching.md).

## Effort

How long the model reasons before it answers, also called thinking. More
effort is usually better and costs more. Chat lets you pick it, and
[Claude Stats](agents/spend.md#what-the-charts-show) shows what it cost.

## MCP

Model Context Protocol: a standard way for agents to use outside tools.
MonoRail offers one; see [let agents use MonoRail](agents/agent-access.md).

## Repository

A folder tracked by git, with its whole history. Also called a repo.
[GitHub+](workspace/browse-repos.md) shows them.

## Commit

One saved change in a repository's history.

## Branch

A separate line of changes in a repository. GitHub+ can
[compare](workspace/browse-repos.md#what-you-can-see) them.

## Issue

A to-do or bug report. MonoRail keeps [local issues](workspace/local-issues.md)
inside a repository and tasks in [Jira+](workspace/jira-plus.md).

## Connection

An account MonoRail is signed in to. See [connect your accounts](setup/connections.md).

## Extension

An add-on page, app or tool built outside MonoRail. See
[add extensions](setup/extensions.md).

## Data folder

The folder in your user profile where MonoRail keeps everything private,
`%APPDATA%\MonoRail`. See [private data stays local](private-data.md).

## Profile

One person's settings and data inside MonoRail: appearance, connections,
backups and so on. There is one profile today; Developer Mode adds a hidden,
always-empty **New User** profile for testing. See
[Developer Mode](setup/developer-mode.md) and, for the details,
[Profiles](../profiles.md).

## For people and for agents

The tags on every wiki page. *For people* pages are plain guides; *for
agents* pages are exact reference for agents and developers. See [how to read
this wiki](README.md#how-to-read-this-wiki).
