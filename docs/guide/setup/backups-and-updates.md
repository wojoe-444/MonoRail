---
audience: human
summary: Copy your local work to a safe folder on a schedule, and keep MonoRail itself up to date.
---

# Backups and updates

## Backups

MonoRail can copy your local work into a folder on a schedule. Pick a folder
that is already backed up or synced, such as a OneDrive folder, and your work
goes wherever that folder goes. MonoRail never uploads anything itself.

1. Open **Settings > Backups**.
2. Choose a folder, how often ("3 times a day") and how many copies to keep.
3. Turn it on.

Each page gets its own subfolder:

- [GitHub+](../workspace/browse-repos.md#backups) repositories, with their
  [local issues](../workspace/local-issues.md);
- your [Jira+](../workspace/jira-plus.md#private-projects) private projects;
- your [Flashcards](../../flashcards.md) decks;
- your [Notes](../../notes.md);
- your [flows](../agents/flows.md#versions), with every version.

**Back up now** runs a backup right away. A repository can also have its own
folder or schedule on GitHub+'s **Backups** tab; its own settings win over
the global ones.

If MonoRail was closed when a backup was due, it runs once when you open the
app. Changing the folder only affects future backups; old ones stay where
they are, because MonoRail [never moves your
files](../private-data.md#what-monorail-reads-and-leaves-alone).

How to restore, and every detail: [Backups](../../backups.md).

## Updates

MonoRail updates itself. Half a minute after it starts, and every four hours
after that, it checks for a new version. When there is one, a small pop-up in
the lower right offers:

- **Download and Restart**: installs the update and reopens MonoRail.
- **Ignore for six hours**: asks again later.
- **X**: hides it until the next check.

The pop-up also lists **what's new**: the newest few changes since the
version you have. **Settings > General** shows the whole list, every change in every
update you skipped, grouped by version. The notes come from the changes that
went into each update, written for people using the app.

**Your data is backed up first.** When you have a backup folder set (see
[Backups](#backups) above), MonoRail backs up your Jira+ private projects,
Notes, Flashcards and flows into a `before-update` subfolder right before an update
installs, and keeps the last five of each. This is on by default; you can turn
it off with **Back up before updating** in **Settings > Backups**. If that
backup fails, nothing is installed: the pop-up says what went wrong and lets
you **Try again** or **Update without a backup**. Without a backup folder the
update simply goes ahead, and the pop-up suggests setting one up. Details:
[Back up before updating](../../backups.md#back-up-before-updating).

You can also check at any time with **Settings > General > Check for updates**. Your
data and settings stay as they are across updates, in the same [data
folder](../private-data.md#where-your-data-lives). If the installer
complains, see the [questions and answers](../faq.md#the-installer-says-failed-to-uninstall-old-application-files).

## Related

- The rest of [setup](README.md).
- How much space backups and caches take: [Storage](../../storage.md).
