---
audience: human
summary: Read and reply to Gmail or classic Outlook directly in MonoRail without saving mail to disk.
---

# Email

**Tools > Email** reads your inbox through either **Gmail** or **classic Outlook
for Windows**.

## Gmail

Connects via Google OAuth using your own free "Desktop app" registration in
Google Cloud (the setup wizard walks through pasting the two values). Tokens are
encrypted locally ([secrets](../private-data.md#passwords-and-tokens-are-encrypted)).

## Outlook

Connects directly to classic Outlook running on your PC — no sign-in or
registration required. Pick which mailboxes to show; shared mailboxes start
**read-only** to prevent accidental edits. *(The "new" Outlook app is not
supported.)*

## Reading and searching

- Browse folders and threads with read/unread and date-range filters.
- Search the open folder, toggle **All folders**, or search across multiple
  inboxes merged newest-first.
- HTML emails render inside a sandboxed frame with scripts disabled and remote
  images blocked until you allow them.

## Your mail stays yours

Messages are fetched live and never written to disk
([private data stays local](../private-data.md#what-monorail-reads-and-leaves-alone),
[FAQ](../faq.md#does-monorail-send-my-data-anywhere)).

## Related

- [Your workspace](README.md) · [Connect your accounts](../setup/connections.md)
