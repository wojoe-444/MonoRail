---
audience: human
summary: The words used around MonoRail and AI agents, in plain language.
---

# Glossary

**Agent**: an AI program that can do work for you, not only chat: read
files, run commands, make changes. Claude Code and pi are agents.

**Subagent**: a helper agent with its own instructions and tools that a main
agent hands a task to. See [create an agent](create-an-agent.md).

**Skill**: a set of written instructions an agent follows when the task
fits, without its own tools.

**Coordinator**: a special chat in MonoRail that talks to your other chats
for you.

**Session** or **chat**: one conversation with an agent, from first message
to last.

**Model**: the AI that does the thinking, such as Claude Opus, Sonnet or
Haiku. Bigger models are smarter and cost more.

**Token**: the unit models read and write in, roughly three quarters of a
word. Prices are per million tokens.

**Input / output tokens**: what is sent to the model / what it writes back.
Output costs more.

**Cache read / cache write**: text the model has seen recently is stored for
a while so it is cheaper to send again.

**Effort** or **thinking**: how long the model reasons before it answers.
More effort is usually better and costs more.

**MCP (Model Context Protocol)**: a standard way for agents to use outside
tools. MonoRail offers one; see [let agents use MonoRail](agent-access.md).

**Repository** or **repo**: a folder tracked by git, with its whole history.

**Commit**: one saved change in a repository's history.

**Branch**: a separate line of changes in a repository.

**Connection**: an account MonoRail is signed in to, on **Connections**.

**Extension**: an add-on page, app or tool built outside MonoRail. See
[add extensions](extensions.md).

**Data folder**: the folder in your user profile where MonoRail keeps
everything private, `%APPDATA%\MonoRail`. See
[private data stays local](private-data.md).

**For people / For agents**: the tags on every wiki page. *For people*
pages are plain guides; *For agents* pages are exact reference for agents and
developers.
