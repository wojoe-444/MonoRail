---
audience: human
summary: Set up a subagent or a skill so Claude Code can hand work to it.
---

# Create an agent

In Claude Code, an agent you create yourself is usually a
[subagent](../glossary.md#subagent): a helper with its own instructions and
its own set of tools that Claude can hand a task to, such as "review this
change" or "write the release notes". MonoRail shows every subagent it finds
on the **Agents** page, each with its own character from the
[mochi crew](../../mochi-crew.md).

## Where agents live

A subagent is one small text file. Claude Code looks for them in two places:

- **Just for you**, in every project: the `.claude\agents` folder in your
  home folder.
- **For one project**, shared with everyone who works on it: the
  `.claude\agents` folder inside that [repository](../glossary.md#repository).

MonoRail reads both, for your home folder and for every folder you have
[allowed in Chat](chat.md#which-chats-are-listed).

## Write one

Make a file called, for example, `release-notes.md` in one of those folders:

```markdown
---
name: release-notes
description: Writes release notes from the commits since the last tag. Use when asked for release notes or a changelog.
tools: Read, Grep, Glob, Bash
---

You write short, friendly release notes for people who use the app.
Group changes into New, Improved and Fixed. Leave out internal changes.
```

- **name** is how Claude refers to it. It also picks the character: a name
  ending in `writer` or `reviewer` gets that role's look.
- **description** tells Claude *when* to use it, so be specific.
- **tools** limits what it can do. Leave the line out to allow every tool;
  list only reading tools (`Read, Grep, Glob`) for a look-only helper.
- Everything below the second `---` is its instructions, in plain words.

Save the file and open **Agents** in MonoRail: the new subagent is listed. In
[Chat](chat.md), ask for it by name ("use the release-notes agent") or let
Claude pick it from the description.

## Skills

A [skill](../glossary.md#skill) is a set of instructions without its own
tools: a recipe Claude follows when it fits. Each skill is a folder with a
`SKILL.md` file in `.claude\skills` (yours or the project's). pi has skills
too, in its own `skills` folder. MonoRail lists both on the Agents page.

## The Coordinator is an agent too

If you write a subagent called `coordinator`, MonoRail's
[Coordinator](coordinator.md) uses yours instead of its own built-in one.

## Tips

- Start with one job per agent. Small, focused agents are picked more
  reliably and are easier to trust.
- Give look-only agents look-only tools, and try them in **Ask** mode first
  ([modes](chat.md#sending-a-message)).
- Agents and skills are plain files, so you can keep a project's agents in
  git, browse them in [GitHub+](../workspace/browse-repos.md) and share them
  with your team.
- Bigger agents cost more to run; [keep an eye on spending](spend.md).

Claude Code's own documentation covers every option of subagents and skills.
