# Backups

MonoRail can copy your local work to a folder on this computer on a schedule,
for example a folder that OneDrive already syncs. MonoRail itself never uploads
anything: it only writes files into the folder you pick.

## The global backup folder

**Settings > Backups** sets one folder and one frequency for the whole app:
"X times per hour / day / week, keep the newest N". When it is on, it is the
default for every page's backups, and **each page gets its own subfolder**, so
the folder itself stays tidy:

```
<backup folder>\
  github-plus\<repo name>\<repo name>-2026-11-11_200532.bundle
  jira-plus\jira-plus-projects-2026-11-11_200532.bundle
  flashcards\flashcards-2026-11-11_200532.json
```

| Page | What is backed up | How to restore |
| --- | --- | --- |
| GitHub+ | Each repo you set to use the global folder on its **Backups** tab: every branch, tag and commit as one `.bundle` | `git clone "<file>" <name>` |
| Jira+ | Your private projects (Jira+'s local git repo) as one `.bundle` | `git clone "<file>"`, then copy it over `local-repo` in Jira+'s data folder with MonoRail closed |
| Flashcards | All decks, cards and study history as one `.json` | Copy it over `decks.json` in the Flashcards data folder with MonoRail closed |

Jira+ and Flashcards run on the global schedule; each has a switch in the
card to leave it out. **Back up now** runs them right away. A page with nothing
to back up yet (no private projects, no decks) is skipped. A damaged
Flashcards file is not backed up, so it cannot push good backups out.

## A page's own settings win

On GitHub+'s **Backups** tab a repo can use the **Global backup folder** or
**Another folder**, and the global frequency (**Same as the global setting**)
or its own. A new schedule starts on the global settings when the global
folder is on. Schedules made before the global folder existed keep their own
folder and frequency.

If the global folder is turned off later, schedules that follow it pause
(their tab says why) instead of failing every minute.

## Changing the folder

Only backups made from then on go to the new folder. **MonoRail never moves,
copies or deletes backups already in an earlier folder.** Old backups are
pruned ("keep the newest N") only in the folder MonoRail is writing to, and
only its own files there (matched by name); anything else in the folder is
left alone.

## How it runs

Backups run inside MonoRail: it checks once a minute and once at startup, so a
backup that came due while the app was closed runs once when it opens. Each
file is written as `.partial` and renamed when complete, so a synced folder
never uploads half a file. After a failure it retries after 15 minutes.

The settings and the last result per page live in `modules\backups` in
MonoRail's data folder (`settings.json`, `state.json`); GitHub+ schedules in
`apps\github-plus\backups.json`. Code: `electron/backups/` (shared schedule
rules, global settings and the Jira+/Flashcards schedule) and
`electron/apps/github-plus/backup.cjs`.
