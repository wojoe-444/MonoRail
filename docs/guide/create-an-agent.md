---
audience: human
summary: Set up a subagent or a skill so Claude Code can hand work to it.
---

# Create an agent

In Claude Code, an "agent" you create yourself is usually a **subagent**: a
helper with its own instructions and its own set of tools that Claude can
hand a task to, such as "review this change" or "write the release notes".
MonoRail shows every subagent it finds on the **Agents** page, each with its
own mochi character.

## Where agents live

A subagent is one small text file. Claude Code looks for them in two places:

- **Just for you**, in every project: the `.claude\agents` folder in your
  home folder.
- **For one project**, shared with everyone who works on it: the
  `.claude\agents` folder inside that repository.

MonoRail reads both, for your home folder and for every folder you have
allowed in Chat.

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

- **name** is how Claude refers to it.
- **description** tells Claude *when* to use it, so be specific.
- **tools** limits what it can do. Leave the line out to allow every tool;
  list only reading tools (`Read, Grep, Glob`) for a look-only helper.
- Everything below the second `---` is its instructions, in plain words.

Save the file and open **Agents** in MonoRail: the new subagent is listed,
with a character picked from its name. In Claude Code, ask for it by name
("use the release-notes agent") or let Claude pick it from the description.

## Skills

A **skill** is a set of instructions without its own tools: a recipe Claude
follows when it fits. Each skill is a folder with a `SKILL.md` file in
`.claude\skills` (yours or the project's). pi has skills too, in its own
`skills` folder. MonoRail lists both on the Agents page.

## Tips

- Start with one job per agent. Small, focused agents are picked more
  reliably and are easier to trust.
- Give look-only agents look-only tools.
- Agents and skills are plain files, so you can keep a project's agents in
  git and share them with your team.

Want the detail? Claude Code's own documentation covers every option of
subagents and skills.
