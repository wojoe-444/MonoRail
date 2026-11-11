---
audience: human
summary: Read and answer Gmail, or the classic Outlook on your PC, without your mail ever being saved by MonoRail.
---

# Email

**Workspace > Email** reads your mail through an inbox connector. There are
two so far: Gmail, and the classic Outlook already running on your PC.

## Gmail

Gmail signs in through Google, with an app registration of your own: the
setup screen walks you through making a free "Desktop app" sign-in in Google
Cloud and pasting its two values. It is a few minutes, once. The values and
your sign-in are encrypted and kept on your computer, like every
[secret](../private-data.md#passwords-and-tokens-are-encrypted).

## Outlook

If you use the classic Outlook for Windows, Email can use it directly: no
sign-in, no registration. Outlook must be open. Setup lists the mailboxes
Outlook has; pick the ones you want. Shared mailboxes start **read-only**, so
you can't change them by accident. (The new Outlook can't be used this way.)

## Reading and searching

- Folders, threads, read and unread, with filters for how many days back.
- Search the open folder, or tick **All folders** for a slower, wider search.
- Search several inboxes at once; results are merged, newest first.

HTML mail is shown in a sealed frame without scripts, and pictures from the
internet stay blocked until you ask for them.

## Your mail stays yours

Mail is fetched when you open it and never written to disk by MonoRail.
[Private data stays local](../private-data.md#what-monorail-reads-and-leaves-alone)
has the full list of what MonoRail keeps, and the
[questions and answers](../faq.md#does-monorail-send-my-data-anywhere) cover
what it sends.

## Related

- Everything else in [your workspace](README.md).
- Other accounts MonoRail can use: [connect your accounts](../setup/connections.md).
