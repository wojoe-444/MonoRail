---
audience: human
summary: Use MonoRail from your phone over your own private Tailscale network. Off until you turn it on, and never on the public internet.
---

# Use MonoRail from your phone

Remote access lets you open MonoRail on your phone while it keeps running on
your PC: read your [chats](../agents/chat.md), send a message to an agent,
check [what your agents cost](../agents/spend.md). It is **off** until you
turn it on in **Settings > Remote access**, and while it is off MonoRail
works exactly as before: no port is opened and nothing looks for Tailscale.

## How it stays private

- Your phone reaches the PC through **Tailscale**, a free private network
  between your own devices. MonoRail is never put on the public internet,
  and turns Remote access off by itself if your Tailscale address ever
  becomes public (Tailscale calls that Funnel).
- MonoRail listens on the PC only (127.0.0.1). Nothing on your Wi-Fi can
  reach it directly.
- Only the Tailscale logins you list under **Who may connect** get in, and
  each phone must also be **paired** with a one-time code from the PC.
- Each paired phone keeps its own key. Revoke it on the PC and it is signed
  out at once. Turning Remote access off signs out every phone.

## Setting it up

1. Install Tailscale on the PC and on your phone, and sign in to the same
   account on both.
2. On the PC, open **Settings > Remote access** and turn it on. MonoRail
   checks Tailscale and fills in your own login under **Who may connect**.
3. If it says the private address is not set up yet, press **Set it up**.
   This runs one Tailscale command on the PC that forwards your private
   address to MonoRail.
4. Press **Pair a phone** and scan the code with the phone's camera. The
   code works once, for two minutes. Give the phone a name and you are in.

Tip: add the page to your phone's home screen so it opens like an app.

## What the phone can and can't do

The phone sees the same pages as the PC. Some things only make sense, or
are only safe, at the PC itself, and the phone is told "Do this on your PC":

- anything that opens a window on the PC, such as a folder picker,
  Explorer, a terminal or a sign-in;
- changing [connections](connections.md), the [spending limit](spending-limit.md),
  [agent access](../agents/agent-access.md), [extensions](extensions.md),
  [backups](backups-and-updates.md) or updates;
- Remote access itself: pairing, revoking and who may connect.

Chats started from the phone run in **Ask** mode (read-only tools) unless
you turn on **Agent mode from the phone**. Your
[spending limit](spending-limit.md) counts phone turns too.

## Closing the window

While Remote access is on, closing MonoRail's window keeps it running in the
system tray, so your phone is not cut off. Right-click the tray icon to open
it again, to turn Remote access off and quit, or just to quit.

## See what happened

The **Activity** card lists what paired devices did: the page and action,
which device, when, and whether it was refused. It never records what you
typed or what came back. Like the rest of your settings it stays on the PC
(see [private data stays local](../private-data.md)).

## For developers

The technical reference is [Remote access](../../remote-access.md).
