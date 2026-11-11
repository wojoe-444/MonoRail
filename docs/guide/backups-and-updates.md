---
audience: human
summary: Copy your local work to a safe folder on a schedule, and keep MonoRail itself up to date.
---

# Backups and updates

## Backups

MonoRail can copy your local work into a folder on a schedule. Pick a folder
that is already backed up or synced, such as a OneDrive folder, and your
work goes wherever that folder goes. MonoRail never uploads anything itself.

1. Open **Settings > Backups**.
2. Choose a folder, how often ("3 times a day") and how many copies to keep.
3. Turn it on.

Each page gets its own subfolder: GitHub+ repositories, your Jira+ projects
and your Flashcards decks. **Back up now** runs a backup right away.

A repository can also have its own folder or schedule on GitHub+'s **Backups**
tab. Its own settings win over the global ones.

If MonoRail was closed when a backup was due, it runs once when you open the
app. Changing the folder only affects future backups; old ones stay where
they are.

More detail, including how to restore: [Backups](../backups.md).

## Updates

MonoRail updates itself. Half a minute after it starts, and every four hours
after that, it checks for a new version. When there is one, a small pop-up
in the lower right offers:

- **Download and Restart**: installs the update and reopens MonoRail.
- **Ignore for six hours**: asks again later.
- **X**: hides it until the next check.

You can also check at any time with **Settings > Check for updates**. Your
data and settings stay as they are across updates.
