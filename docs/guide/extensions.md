---
audience: human
summary: Add pages and apps that other people build, and what an extension is allowed to do.
---

# Add extensions

An **extension** adds something to MonoRail without changing MonoRail
itself: a new page in the menu, a full-screen app, or new tools for your
agents. Extensions are built and released in their own repositories, by
anyone.

## Install one

Open **Configure > Extensions** and choose where it comes from:

- a GitHub repository (MonoRail fetches its latest release),
- a `.zip` file, or
- a folder on your computer.

Before anything runs, MonoRail shows what the extension asks for, such as
reaching certain websites, reading a folder or starting a program, and waits
for your OK.

## What an extension can and can't do

- Its pages run in a sealed box: they can't reach the internet or the rest of
  MonoRail, only their own backend.
- Its backend runs in its own process and can only use the websites, folders
  and programs you approved.
- An extension that may start programs is trusted fully, because a program
  it starts is not sealed in. MonoRail warns you about that one.
- An update that asks for more turns the extension off until you approve
  again.

## Remove one

Remove it on the same page. Its data is kept unless you tick **Also delete
its data**.

## Build your own

Start with [Building MonoRail extensions](../extensions/README.md). The
concepts page and the tutorial are readable without prior knowledge; the
reference pages are written for developers and agents.
