---
audience: human
summary: Use MonoRail from your phone over your private Tailscale network — opt-in, paired per device, never public.
---

# Use MonoRail from your phone

**Settings > Remote access** lets you open MonoRail from your phone to read
[chats](../agents/chat.md), message agents and check
[spending](../agents/spend.md) while MonoRail runs on your PC. Off by default —
while off, no port opens and Tailscale is never queried.

## How it stays private

- Uses **Tailscale** between your own devices only — never exposed publicly (and
  auto-disables if Tailscale Funnel is ever enabled).
- Binds strictly to `127.0.0.1` on your PC so nothing else on Wi-Fi can reach it.
- Requires both an allowed Tailscale login under **Who may connect** and
  one-time QR **pairing** per phone.
- Revoking a phone (or turning Remote access off) signs it out immediately.

## Setting it up

1. Sign in to the same Tailscale account on both PC and phone.
2. Enable **Settings > Remote access** on your PC (pre-fills your login under
   **Who may connect**).
3. Click **Set it up** if prompted to configure Tailscale forwarding.
4. Click **Pair a phone**, scan the 2-minute one-time QR code, and name the
   device. *(Tip: add it to your phone's home screen.)*

## What the phone can and can't do

Actions that belong on the PC show *"Do this on your PC"*:

- Local desktop tools (folder pickers, Explorer, terminals, [Files](../workspace/files.md),
  [Browser](../workspace/browser.md)).
- Sensitive settings: [connections](connections.md),
  [spending limits](spending-limit.md), [agent access](../agents/agent-access.md),
  [extensions](extensions.md), [backups](backups-and-updates.md), updates and
  Remote access pairing.

Phone chats default to **Ask** mode unless you enable **Agent mode from the
phone**, and count toward your [spending limit](spending-limit.md).

## Closing the window

While enabled, closing the window minimizes MonoRail to the system tray so your
phone stays connected (right-click the tray icon to reopen or quit).

## See what happened

The **Activity** card logs device actions and refusals (never message text),
stored locally ([private data stays local](../private-data.md)).

## For developers

Technical reference: [Remote access](../../remote-access.md).
