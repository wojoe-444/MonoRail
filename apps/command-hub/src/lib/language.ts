const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', cs: 'csharp', cpp: 'cpp', cc: 'cpp',
  c: 'c', h: 'c', hpp: 'cpp', php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', json: 'json',
  yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', css: 'css',
  scss: 'scss', less: 'less', md: 'markdown', sql: 'sql', swift: 'swift', lua: 'lua', r: 'r', diff: 'diff', patch: 'diff',
  bat: 'dos', cmd: 'dos', gradle: 'groovy', pl: 'perl', vue: 'xml'
}
export function languageFor(path: string): string | undefined {
  const name = (path.split(/[\\/]/).pop() ?? '').toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  return EXT_LANG[name.split('.').pop() ?? '']
}

