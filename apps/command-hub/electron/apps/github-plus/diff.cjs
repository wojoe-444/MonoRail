// GitHub+ app: parse unified diff output from `git diff` / `git show -p`.
// Ported from wojoe-444/Local-Repo-UI (src/main/diff.ts).

function parseDiff(raw) {
  const files = []
  let file = null
  let hunk = null
  let oldNo = 0
  let newNo = 0

  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = /^diff --git a\/(.*) b\/(.*)$/.exec(line)
      file = { oldPath: m?.[1] ?? '', newPath: m?.[2] ?? '', status: 'modified', binary: false, additions: 0, deletions: 0, hunks: [] }
      files.push(file)
      hunk = null
      continue
    }
    if (!file) continue

    if (!hunk) {
      if (line.startsWith('new file mode')) file.status = 'added'
      else if (line.startsWith('deleted file mode')) file.status = 'deleted'
      else if (line.startsWith('rename from ')) {
        file.status = 'renamed'
        file.oldPath = line.slice(12)
      } else if (line.startsWith('rename to ')) file.newPath = line.slice(10)
      else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) file.binary = true
      else if (line.startsWith('--- ')) {
        if (line !== '--- /dev/null') file.oldPath = line.slice(4).replace(/^a\//, '')
      } else if (line.startsWith('+++ ')) {
        if (line !== '+++ /dev/null') file.newPath = line.slice(4).replace(/^b\//, '')
      }
    }

    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (h) {
      oldNo = Number(h[1])
      newNo = Number(h[2])
      hunk = { header: line, lines: [] }
      file.hunks.push(hunk)
      continue
    }
    if (!hunk) continue

    const c = line[0]
    if (c === '+') {
      hunk.lines.push({ type: 'add', content: line.slice(1), oldNo: null, newNo: newNo++ })
      file.additions++
    } else if (c === '-') {
      hunk.lines.push({ type: 'del', content: line.slice(1), oldNo: oldNo++, newNo: null })
      file.deletions++
    } else if (c === ' ') hunk.lines.push({ type: 'context', content: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
    else if (c === '\\') hunk.lines.push({ type: 'meta', content: line, oldNo: null, newNo: null })
  }
  return files
}

module.exports = { parseDiff }
