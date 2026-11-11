// Runs before `npm run desktop` / `desktop:prod`. After a `git pull` that adds a
// dependency, Electron would otherwise stop with "Cannot find module 'x'" in a
// main-process error dialog. This names the missing packages and the fix.

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
const missing = wanted.filter((name) => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json')))

if (missing.length) {
  console.error(`\nMissing packages: ${missing.join(', ')}`)
  console.error('The code was updated with new dependencies. Run `npm install` in apps/command-hub, then try again.\n')
  process.exit(1)
}
