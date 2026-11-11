// Read a generic credential from Windows Credential Manager
// (Control Panel > Credential Manager > Windows Credentials > Generic).
//
// No native addon: a short PowerShell script calls advapi32 CredRead /
// CredEnumerate through Add-Type. The entry name is passed in an environment
// variable, never spliced into the script. The secret comes back only to the
// main process; MonoRail does not copy it into its own storage, it reads the
// entry each time it needs it, so updating the entry in Credential Manager is
// all it takes to rotate a token.

const { spawn } = require('node:child_process')

const CRED_TYPE_GENERIC = 1

const PREAMBLE = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class MonoRailCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr creds);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
}
"@
`

const READ_SCRIPT = `${PREAMBLE}
$p = [IntPtr]::Zero
if (-not [MonoRailCred]::CredRead($env:MONORAIL_CRED_TARGET, ${CRED_TYPE_GENERIC}, 0, [ref]$p)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [Console]::Out.Write((@{ found = $false; error = $code } | ConvertTo-Json -Compress))
  exit 0
}
try {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][MonoRailCred+CREDENTIAL])
  $bytes = New-Object byte[] $c.CredentialBlobSize
  if ($c.CredentialBlobSize -gt 0) { [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $bytes, 0, $c.CredentialBlobSize) }
  [Console]::Out.Write((@{ found = $true; userName = $c.UserName; blob = [Convert]::ToBase64String($bytes) } | ConvertTo-Json -Compress))
} finally { [MonoRailCred]::CredFree($p) }
`

const LIST_SCRIPT = `${PREAMBLE}
$count = 0; $p = [IntPtr]::Zero
$items = @()
if ([MonoRailCred]::CredEnumerate($null, 0, [ref]$count, [ref]$p)) {
  try {
    $size = [Runtime.InteropServices.Marshal]::SizeOf([type][IntPtr])
    for ($i = 0; $i -lt $count; $i++) {
      $cp = [Runtime.InteropServices.Marshal]::ReadIntPtr($p, $i * $size)
      $c = [Runtime.InteropServices.Marshal]::PtrToStructure($cp, [type][MonoRailCred+CREDENTIAL])
      if ($c.Type -eq ${CRED_TYPE_GENERIC}) { $items += @{ target = $c.TargetName; userName = $c.UserName } }
    }
  } finally { [MonoRailCred]::CredFree($p) }
}
[Console]::Out.Write((ConvertTo-Json -InputObject @($items) -Compress))
`

/**
 * Credential blobs are bytes. Credential Manager's own UI, cmdkey and most
 * libraries store UTF-16LE; some tools store UTF-8. ASCII text in UTF-16LE
 * has a zero in every odd byte, which UTF-8 text never has.
 */
function decodeBlob(buf) {
  if (!buf?.length) return ''
  if (buf.length % 2 === 0) {
    let zeros = 0
    for (let i = 1; i < buf.length; i += 2) if (buf[i] === 0) zeros++
    if (zeros >= buf.length / 4) return buf.toString('utf16le').replace(/\0+$/, '').trim()
  }
  return buf.toString('utf8').replace(/\0+$/, '').trim()
}

function validTarget(target) {
  const t = typeof target === 'string' ? target.trim() : ''
  if (!t) throw new Error('Enter the name of the Credential Manager entry.')
  if (t.length > 512 || /[\0\r\n]/.test(t)) throw new Error('That Credential Manager entry name is not valid.')
  return t
}

function runPowerShell(script, env) {
  if (process.platform !== 'win32') return Promise.reject(new Error('Windows Credential Manager is only available on Windows.'))
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const exe = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        resolve(JSON.parse(out.trim()))
      } catch {
        reject(new Error(`Could not read Credential Manager${code ? ` (PowerShell exit ${code})` : ''}. ${err.split('\n')[0] ?? ''}`.trim()))
      }
    })
  })
}

/** { userName, secret } for a generic credential. Throws a readable error when missing. */
async function readCredential(target) {
  const t = validTarget(target)
  const r = await runPowerShell(READ_SCRIPT, { MONORAIL_CRED_TARGET: t })
  if (!r.found) {
    if (r.error === 1168) throw new Error(`No generic credential named "${t}" in Windows Credential Manager.`)
    throw new Error(`Windows Credential Manager could not read "${t}" (error ${r.error}).`)
  }
  return { userName: r.userName || '', secret: decodeBlob(Buffer.from(r.blob || '', 'base64')) }
}

/** Names (and user names) of the generic credentials, never their secrets. */
async function listCredentials() {
  const items = await runPowerShell(LIST_SCRIPT, {})
  return (Array.isArray(items) ? items : [])
    .filter((i) => i && typeof i.target === 'string')
    .map((i) => ({ target: i.target, userName: i.userName || '' }))
    .sort((a, b) => a.target.localeCompare(b.target))
}

module.exports = { readCredential, listCredentials, decodeBlob, validTarget }
