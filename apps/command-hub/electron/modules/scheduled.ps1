$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:MONORAIL_SCHEDULED_ARGS)) | ConvertFrom-Json
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
function IsOwner($t) {
  try { return ([Security.Principal.NTAccount]::new($t.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid } catch { return $t.Principal.UserId -eq $sid }
}
if ($a.action -eq 'list') {
  $tasks = @(Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object {
    $t = $_
    $info = $null
    try { $info = $t | Get-ScheduledTaskInfo -ErrorAction Stop } catch {}
    $triggers = @($t.Triggers | ForEach-Object {
      $kind = $_.CimClass.CimClassName -replace '^MSFT_Task', '' -replace 'Trigger$', ''
      $label = switch ($kind) { 'Logon' { 'At log on' } 'Boot' { 'At startup' } 'Daily' { 'Daily' } 'Weekly' { 'Weekly' } 'Time' { 'Once' } default { $kind } }
      if ($_.StartBoundary -and $kind -in @('Daily','Weekly','Time')) { try { $label += ' at ' + ([datetime]$_.StartBoundary).ToString('g') } catch {} }
      if ($_.Repetition.Interval) { $label += '; repeats ' + $_.Repetition.Interval }
      $label
    })
    $last = if ($info -and $info.LastRunTime.Year -gt 1900) { $info.LastRunTime.ToString('o') } else { $null }
    $next = if ($info -and $info.NextRunTime.Year -gt 1900) { $info.NextRunTime.ToString('o') } else { $null }
    [pscustomobject]@{ name=$t.TaskName; path=$t.TaskPath; description=$t.Description; command=(($t.Actions | ForEach-Object { $_.Execute }) -join ', '); schedule=($triggers -join '; '); state=[string]$t.State; lastRun=$last; nextRun=$next; result=if ($info) { [long]$info.LastTaskResult } else { $null }; writable=(IsOwner $t) }
  })
  @{ tasks=$tasks; readAt=[datetime]::UtcNow.ToString('o') } | ConvertTo-Json -Depth 6 -Compress
} else {
  if ($a.action -notin @('run','stop','enable','disable','delete')) { throw 'Unknown action' }
  if (-not $a.name -or -not $a.path -or $a.path -like '\Microsoft\*') { throw 'Invalid task' }
  # Cmdlet parameters accept wildcards: enumerate and match literally before changing anything.
  $matches = @(Get-ScheduledTask | Where-Object { $_.TaskName -eq $a.name -and $_.TaskPath -eq $a.path })
  if ($matches.Count -ne 1) { throw 'Task not found.' }
  $t = $matches[0]
  if (-not (IsOwner $t)) { throw 'Only tasks running as the current user can be changed here.' }
  switch ($a.action) {
    'run' { $t | Start-ScheduledTask }
    'stop' { $t | Stop-ScheduledTask }
    'enable' { $t | Enable-ScheduledTask | Out-Null }
    'disable' { $t | Disable-ScheduledTask | Out-Null }
    'delete' { $t | Unregister-ScheduledTask -Confirm:$false }
  }
  '{}'
}
