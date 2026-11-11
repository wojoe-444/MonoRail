# MonoRail Email: Outlook helper. Run by connectors/outlook.cjs through
# helper.cjs as a hidden Windows PowerShell 5.1 process, one operation per run.
#
# Input: $env:MONORAIL_ARGS, base64 JSON { op, storeId, ... }. Values are only
# ever used as data (COM arguments, comparisons), never run as code.
# Output: one JSON object on stdout, { ok, result } or { ok: false, code, message }.
#
# Rules from the field:
# - Attach to the Outlook that is already running (GetActiveObject). Never
#   start Outlook, and never read Namespace.CurrentUser: it raises Outlook's
#   "a program is trying to access e-mail address information" prompt.
# - Stores are found by StoreID. Messages are found by their long EntryID; when
#   that fails (the mail moved, e.g. to Archive) they are looked up again by
#   internet message ID.
# - Slow (online-only shared) mailboxes: every walk checks a deadline and
#   returns what it has, marked timedOut.
# Keep this file ASCII.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$PR_INTERNET_MESSAGE_ID = 'http://schemas.microsoft.com/mapi/proptag/0x1035001F'
$PR_SENDER_SMTP = 'http://schemas.microsoft.com/mapi/proptag/0x5D01001F'
$PR_ATTR_HIDDEN = 'http://schemas.microsoft.com/mapi/proptag/0x10F4000B'
# olFolder* numbers for the folders that get a role (and a fixed id).
$ROLE_FOLDERS = [ordered]@{ INBOX = 6; DRAFT = 16; SENT = 5; SPAM = 23; TRASH = 3 }
$ROLE_NAMES = @{ INBOX = 'inbox'; DRAFT = 'drafts'; SENT = 'sent'; SPAM = 'spam'; TRASH = 'trash' }

function Fail([string]$code, [string]$message) {
  $ex = New-Object System.Exception $message
  $ex.Data['monorailCode'] = $code
  throw $ex
}

function Write-Answer($obj) {
  [Console]::Out.Write(($obj | ConvertTo-Json -Depth 12 -Compress))
}

function Iso($d) {
  if ($null -eq $d) { return $null }
  try {
    $dt = [datetime]$d
    if ($dt.Year -ge 4000) { return $null }
    return $dt.ToUniversalTime().ToString('o')
  } catch { return $null }
}

function Try-Get([scriptblock]$block, $fallback) {
  try { $v = & $block; if ($null -eq $v) { return $fallback } return $v } catch { return $fallback }
}

function Get-Outlook {
  if (-not (Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue)) {
    Fail 'not-running' 'Outlook is not running. Open Outlook, then try again.'
  }
  try {
    return [System.Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
  } catch {
    Fail 'not-running' 'Outlook is open but did not answer. If one of Outlook and MonoRail runs as administrator and the other does not, start them the same way. New Outlook is not supported; use classic Outlook.'
  }
}

function Get-Store($ns, [string]$storeId) {
  foreach ($s in $ns.Stores) {
    if ($s.StoreID -eq $storeId) { return $s }
  }
  Fail 'store-missing' 'That mailbox is not open in Outlook any more. Add it in Outlook, or remove it here.'
}

function Get-RoleFolders($store) {
  $map = @{}
  foreach ($k in $ROLE_FOLDERS.Keys) {
    try {
      $f = $store.GetDefaultFolder($ROLE_FOLDERS[$k])
      if ($null -ne $f) { $map[$k] = $f }
    } catch { }
  }
  return $map
}

function Is-Skipped([string]$path, $skip) {
  $p = $path.ToLowerInvariant()
  foreach ($s in $skip) {
    if ($p -eq $s -or $p.StartsWith($s + '\')) { return $true }
  }
  return $false
}

function Is-Hidden($folder) {
  try { return [bool]$folder.PropertyAccessor.GetProperty($PR_ATTR_HIDDEN) } catch { return $false }
}

# Folder by id: a role id (INBOX, SENT, ...) or a path of names from the store root.
function Resolve-Folder($store, [string]$id) {
  if ([string]::IsNullOrEmpty($id)) { $id = 'INBOX' }
  if ($ROLE_FOLDERS.Contains($id)) {
    try { return $store.GetDefaultFolder($ROLE_FOLDERS[$id]) } catch { Fail 'folder-missing' 'This mailbox has no such folder.' }
  }
  $f = $store.GetRootFolder()
  foreach ($name in $id.Split('\')) {
    if ($name -eq '') { continue }
    try { $f = $f.Folders.Item($name) } catch { $f = $null }
    if ($null -eq $f) { Fail 'folder-missing' 'That folder was renamed or removed. Pick it again in the folder list.' }
  }
  return $f
}

# Mail folders in store order, depth first: { folder, id, path, parentId, depth }.
function Walk-Folders($store, $skip, [datetime]$deadline, [int]$maxDepth, [int]$maxFolders) {
  $roles = Get-RoleFolders $store
  $roleById = @{}
  foreach ($k in $roles.Keys) { try { $roleById[$roles[$k].EntryID] = $k } catch { } }
  $out = New-Object System.Collections.ArrayList
  $state = @{ timedOut = $false }
  $stack = New-Object System.Collections.Stack
  $root = $store.GetRootFolder()
  $kids = @(); try { $kids = @($root.Folders) } catch { }
  [array]::Reverse($kids)
  foreach ($k in $kids) { $stack.Push(@{ folder = $k; path = $null; parentId = $null; depth = 0 }) }
  while ($stack.Count -gt 0) {
    if ([datetime]::Now -gt $deadline -or $out.Count -ge $maxFolders) { $state.timedOut = $true; break }
    $n = $stack.Pop()
    $f = $n.folder
    $name = Try-Get { $f.Name } ''
    $path = if ($n.path) { $n.path + '\' + $name } else { $name }
    $itemType = Try-Get { [int]$f.DefaultItemType } -1
    if ($itemType -ne 0) { continue }
    if (Is-Skipped $path $skip) { continue }
    if (Is-Hidden $f) { continue }
    $eid = Try-Get { $f.EntryID } ''
    $role = $roleById[$eid]
    $id = if ($role) { $role } else { $path }
    [void]$out.Add(@{ folder = $f; id = $id; path = $path; name = $name; parentId = $n.parentId; depth = $n.depth; role = $role })
    if ($n.depth + 1 -lt $maxDepth) {
      $sub = @(); try { $sub = @($f.Folders) } catch { }
      [array]::Reverse($sub)
      foreach ($s in $sub) { $stack.Push(@{ folder = $s; path = $path; parentId = $id; depth = $n.depth + 1 }) }
    }
  }
  return @{ list = $out; timedOut = $state.timedOut }
}

function Sender-Of($it) {
  $name = Try-Get { $it.SenderName } ''
  $addr = Try-Get { $it.PropertyAccessor.GetProperty($PR_SENDER_SMTP) } ''
  if (-not $addr) {
    $raw = Try-Get { $it.SenderEmailAddress } ''
    if ($raw -like '*@*') { $addr = $raw }
  }
  if ($name -and $addr -and $name -ne $addr) { return "$name <$addr>" }
  if ($addr) { return $addr }
  return $name
}

function Summary-Of($it, [string]$folderId, [string]$folderPath, [bool]$withSnippet) {
  $snippet = ''
  if ($withSnippet) {
    $b = Try-Get { [string]$it.Body } ''
    if ($b.Length -gt 400) { $b = $b.Substring(0, 400) }
    $snippet = ($b -replace '\s+', ' ').Trim()
    if ($snippet.Length -gt 200) { $snippet = $snippet.Substring(0, 200) }
  }
  $flag = Try-Get { [int]$it.FlagStatus } 0
  return @{
    entryId = Try-Get { $it.EntryID } ''
    messageId = Try-Get { [string]$it.PropertyAccessor.GetProperty($PR_INTERNET_MESSAGE_ID) } ''
    subject = Try-Get { [string]$it.Subject } ''
    from = Sender-Of $it
    date = Iso (Try-Get { $it.ReceivedTime } $null)
    unread = Try-Get { [bool]$it.UnRead } $false
    flagged = ($flag -eq 2)
    attachments = Try-Get { [int]$it.Attachments.Count } 0
    snippet = $snippet
    folderId = $folderId
    folderPath = $folderPath
  }
}

# Newest first from one folder: optional DASL filter, days back, offset paging.
function List-Folder($folder, [string]$folderId, [string]$folderPath, $a, [datetime]$deadline, [int]$offset, [int]$limit, $out, [datetime]$snippetUntil) {
  $items = $folder.Items
  if ($a.filter) { $items = $items.Restrict([string]$a.filter) }
  $items.Sort('[ReceivedTime]', $true)
  $cutoff = $null
  if ($a.daysBack) { $cutoff = [datetime]::Now.AddDays(-[double]$a.daysBack) }
  $skipped = 0
  $more = $false
  $timedOut = $false
  $it = $items.GetFirst()
  while ($null -ne $it) {
    if ([datetime]::Now -gt $deadline) { $timedOut = $true; break }
    $cls = Try-Get { [string]$it.MessageClass } ''
    if ($cls.StartsWith('IPM.')) {
      if ($null -ne $cutoff) {
        $rt = Try-Get { [datetime]$it.ReceivedTime } $null
        if ($null -ne $rt -and $rt -lt $cutoff) { break }
      }
      if ($skipped -lt $offset) { $skipped++ }
      elseif ($out.Count -ge $limit) { $more = $true; break }
      else { [void]$out.Add((Summary-Of $it $folderId $folderPath ([datetime]::Now -lt $snippetUntil))) }
    }
    $it = $items.GetNext()
  }
  return @{ more = $more; timedOut = $timedOut }
}

function Find-ByMessageId($ns, $store, [string]$messageId, $skip, [datetime]$deadline) {
  if (-not $messageId) { return $null }
  $filter = '@SQL="' + $PR_INTERNET_MESSAGE_ID + '" = ''' + $messageId.Replace("'", "''") + ''''
  $tried = @{}
  $first = New-Object System.Collections.ArrayList
  foreach ($k in @('INBOX', 'SENT')) { try { [void]$first.Add($store.GetDefaultFolder($ROLE_FOLDERS[$k])) } catch { } }
  try { [void]$first.Add($store.GetRootFolder().Folders.Item('Archive')) } catch { }
  foreach ($f in $first) {
    if ($null -eq $f) { continue }
    $tried[(Try-Get { $f.EntryID } '')] = $true
    $hit = Try-Get { $f.Items.Find($filter) } $null
    if ($null -ne $hit) { return $hit }
  }
  $walk = Walk-Folders $store $skip $deadline 12 5000
  foreach ($n in $walk.list) {
    if ([datetime]::Now -gt $deadline) { break }
    if ($tried[(Try-Get { $n.folder.EntryID } '')]) { continue }
    $hit = Try-Get { $n.folder.Items.Find($filter) } $null
    if ($null -ne $hit) { return $hit }
  }
  return $null
}

# The item, and whether it had to be looked up again (its EntryID changed).
function Resolve-Item($ns, $store, $a) {
  if ($a.entryId) {
    try {
      $it = $ns.GetItemFromID([string]$a.entryId, [string]$a.storeId)
      if ($null -ne $it) { return @{ item = $it; moved = $false } }
    } catch { }
  }
  $deadline = [datetime]::Now.AddMilliseconds([double]$a.lookupMs)
  $it = Find-ByMessageId $ns $store ([string]$a.messageId) $a.skip $deadline
  if ($null -eq $it) { Fail 'not-found' 'This message was moved or deleted, and Outlook could not find it again.' }
  return @{ item = $it; moved = $true }
}

function Folder-IdOf($store, $item) {
  try {
    $parent = $item.Parent
    $roles = Get-RoleFolders $store
    foreach ($k in $roles.Keys) {
      if ($roles[$k].EntryID -eq $parent.EntryID) { return $k }
    }
    $names = New-Object System.Collections.ArrayList
    $rootId = $store.GetRootFolder().EntryID
    $f = $parent
    for ($i = 0; $i -lt 16 -and $null -ne $f -and $f.EntryID -ne $rootId; $i++) {
      [void]$names.Insert(0, $f.Name)
      $f = $f.Parent
    }
    return ($names -join '\')
  } catch { return '' }
}

function Recipients-Of($item, [int]$type) {
  $list = New-Object System.Collections.ArrayList
  try {
    foreach ($r in $item.Recipients) {
      if ($r.Type -ne $type) { continue }
      $name = Try-Get { $r.Name } ''
      $addr = Try-Get { $r.PropertyAccessor.GetProperty('http://schemas.microsoft.com/mapi/proptag/0x39FE001F') } ''
      if (-not $addr) { $raw = Try-Get { $r.Address } ''; if ($raw -like '*@*') { $addr = $raw } }
      if ($name -and $addr -and $name -ne $addr) { [void]$list.Add('"' + $name.Replace('"', '') + '" <' + $addr + '>') }
      elseif ($addr) { [void]$list.Add($addr) }
      elseif ($name) { [void]$list.Add($name) }
    }
  } catch { }
  return ($list -join ', ')
}

function Op-Discover($ol) {
  $ns = $ol.Session
  $addresses = @{}
  try {
    foreach ($acc in $ns.Accounts) {
      try { $addresses[$acc.DeliveryStore.StoreID] = [string]$acc.SmtpAddress } catch { }
    }
  } catch { }
  $stores = New-Object System.Collections.ArrayList
  foreach ($s in $ns.Stores) {
    $sid = Try-Get { $s.StoreID } ''
    if (-not $sid) { continue }
    [void]$stores.Add(@{
      storeId = $sid
      name = Try-Get { [string]$s.DisplayName } ''
      address = $addresses[$sid]
      exchangeType = Try-Get { [int]$s.ExchangeStoreType } -1
      isDataFile = Try-Get { [bool]$s.IsDataFileStore } $false
    })
  }
  return @{ stores = $stores }
}

function Op-Folders($ol, $a) {
  $store = Get-Store $ol.Session ([string]$a.storeId)
  $deadline = [datetime]::Now.AddMilliseconds([double]$a.deadlineMs)
  $walk = Walk-Folders $store $a.skip $deadline 10 2000
  $folders = New-Object System.Collections.ArrayList
  foreach ($n in $walk.list) {
    $unread = $null
    if ($n.role -eq 'INBOX' -or $n.depth -le 1) { $unread = Try-Get { [int]$n.folder.UnReadItemCount } $null }
    [void]$folders.Add(@{ id = $n.id; name = $n.name; path = $n.path; parentId = $n.parentId; depth = $n.depth; role = $(if ($n.role) { $ROLE_NAMES[$n.role] } else { $null }); unread = $unread })
  }
  return @{ folders = $folders; timedOut = $walk.timedOut }
}

function Op-List($ol, $a) {
  $store = Get-Store $ol.Session ([string]$a.storeId)
  $deadline = [datetime]::Now.AddMilliseconds([double]$a.deadlineMs)
  $snippetUntil = [datetime]::Now.AddSeconds(8)
  $offset = [int]$a.offset
  $limit = [int]$a.limit
  $out = New-Object System.Collections.ArrayList
  if ($a.allFolders) {
    # Full-store search: every mail folder (minus the skip list) until the deadline.
    # Paging does not apply; the newest matches from each folder are merged.
    $walk = Walk-Folders $store $a.skip $deadline 10 2000
    $timedOut = $walk.timedOut
    $folders = 0
    foreach ($n in $walk.list) {
      if ([datetime]::Now -gt $deadline) { $timedOut = $true; break }
      $part = New-Object System.Collections.ArrayList
      $r = List-Folder $n.folder $n.id $n.path $a $deadline 0 $limit $part $snippetUntil
      foreach ($x in $part) { [void]$out.Add($x) }
      $folders++
      if ($r.timedOut) { $timedOut = $true; break }
    }
    return @{ items = $out; more = $false; timedOut = $timedOut; foldersSearched = $folders; foldersTotal = $walk.list.Count }
  }
  $folder = Resolve-Folder $store ([string]$a.folderId)
  $path = Try-Get { $folder.Name } ''
  $r = List-Folder $folder ([string]$a.folderId) $path $a $deadline $offset $limit $out $snippetUntil
  return @{ items = $out; more = $r.more; timedOut = $r.timedOut }
}

function Op-Get($ol, $a) {
  $ns = $ol.Session
  $store = Get-Store $ns ([string]$a.storeId)
  $found = Resolve-Item $ns $store $a
  $it = $found.item
  $folderId = Folder-IdOf $store $it
  $s = Summary-Of $it $folderId '' $false
  $text = Try-Get { [string]$it.Body } ''
  $html = ''
  $format = Try-Get { [int]$it.BodyFormat } 1
  if ($format -eq 2) { $html = Try-Get { [string]$it.HTMLBody } '' }
  $max = 2000000
  if ($text.Length -gt $max) { $text = $text.Substring(0, $max) }
  if ($html.Length -gt $max) { $html = '' }
  $atts = New-Object System.Collections.ArrayList
  try {
    foreach ($att in $it.Attachments) {
      [void]$atts.Add(@{ id = [string](Try-Get { $att.Index } 0); filename = Try-Get { [string]$att.FileName } ''; size = Try-Get { [int]$att.Size } 0 })
    }
  } catch { }
  $s.to = Recipients-Of $it 1
  $s.cc = Recipients-Of $it 2
  $s.text = $text
  $s.html = $html
  $s.attachmentList = $atts
  $s.moved = $found.moved
  return $s
}

function Op-Modify($ol, $a) {
  $ns = $ol.Session
  $store = Get-Store $ns ([string]$a.storeId)
  $found = Resolve-Item $ns $store $a
  $it = $found.item
  switch ([string]$a.action) {
    'read' { $it.UnRead = -not [bool]$a.value; $it.Save() }
    'flag' { if ([bool]$a.value) { $it.FlagStatus = 2 } else { $it.FlagStatus = 0 }; $it.Save() }
    'move' {
      $target = $null
      if ([string]$a.to -eq 'ARCHIVE') {
        try { $target = $store.GetRootFolder().Folders.Item('Archive') } catch { $target = $null }
        if ($null -eq $target) { Fail 'folder-missing' 'This mailbox has no Archive folder. Create one in Outlook first.' }
      } else {
        $target = Resolve-Folder $store ([string]$a.to)
      }
      $it = $it.Move($target)
    }
    default { Fail 'bad-request' 'Unknown change.' }
  }
  $s = Summary-Of $it (Folder-IdOf $store $it) '' $false
  return $s
}

function Op-CreateFolder($ol, $a) {
  $store = Get-Store $ol.Session ([string]$a.storeId)
  $root = $store.GetRootFolder()
  $f = $root.Folders.Add([string]$a.name)
  return @{ id = [string]$f.Name; name = [string]$f.Name }
}

function Op-Send($ol, $a) {
  $ns = $ol.Session
  $store = Get-Store $ns ([string]$a.storeId)
  if ($a.reply) {
    $found = Resolve-Item $ns $store $a.reply
    $m = $found.item.Reply()
  } else {
    $m = $ol.CreateItem(0)
    $m.Subject = [string]$a.subject
  }
  $m.To = [string]$a.to
  $m.CC = [string]$a.cc
  $m.BCC = [string]$a.bcc
  $m.BodyFormat = 1
  $m.Body = [string]$a.body
  $account = $null
  try {
    foreach ($acc in $ns.Accounts) {
      try { if ($acc.DeliveryStore.StoreID -eq $store.StoreID) { $account = $acc; break } } catch { }
    }
  } catch { }
  if ($null -ne $account) {
    # Plain assignment of a COM object to SendUsingAccount fails in PowerShell.
    [void]$m.GetType().InvokeMember('SendUsingAccount', 'SetProperty', $null, $m, $account)
  } elseif ($a.address) {
    $m.SentOnBehalfOfName = [string]$a.address
  }
  if (-not $m.Recipients.ResolveAll()) {
    $m.Close(1)
    Fail 'bad-recipient' 'Outlook could not resolve every recipient. Check the addresses.'
  }
  $m.Send()
  return @{ sent = $true }
}

try {
  $json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:MONORAIL_ARGS))
  $a = $json | ConvertFrom-Json
  $skip = New-Object System.Collections.ArrayList
  if ($a.skip) { foreach ($s in $a.skip) { [void]$skip.Add(([string]$s).ToLowerInvariant().Trim('\')) } }
  $a | Add-Member -NotePropertyName skip -NotePropertyValue $skip -Force
  foreach ($k in @('deadlineMs', 'lookupMs')) {
    if (-not $a.$k) { $a | Add-Member -NotePropertyName $k -NotePropertyValue 20000 -Force }
  }
  if ($a.reply) {
    $a.reply | Add-Member -NotePropertyName storeId -NotePropertyValue $a.storeId -Force
    $a.reply | Add-Member -NotePropertyName lookupMs -NotePropertyValue $a.lookupMs -Force
  }
  if ($a.reply) { $a.reply | Add-Member -NotePropertyName skip -NotePropertyValue $skip -Force }
  $ol = Get-Outlook
  $result = switch ([string]$a.op) {
    'discover' { Op-Discover $ol }
    'folders' { Op-Folders $ol $a }
    'list' { Op-List $ol $a }
    'get' { Op-Get $ol $a }
    'modify' { Op-Modify $ol $a }
    'createFolder' { Op-CreateFolder $ol $a }
    'send' { Op-Send $ol $a }
    default { Fail 'bad-request' 'Unknown operation.' }
  }
  Write-Answer @{ ok = $true; result = $result }
} catch {
  $e = $_.Exception
  $code = $null
  $x = $e
  while ($null -ne $x -and -not $code) { $code = $x.Data['monorailCode']; $x = $x.InnerException }
  if (-not $code) { $code = 'outlook' }
  $msg = $e.Message
  if ($e.InnerException -and $code -eq 'outlook') { $msg = $e.InnerException.Message }
  Write-Answer @{ ok = $false; code = [string]$code; message = [string]$msg }
}
