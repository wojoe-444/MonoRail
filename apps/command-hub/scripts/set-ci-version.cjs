// CI only: stamp package.json with <major>.<minor>.<run number> so every build
// has a unique, increasing version. electron-updater compares versions, so the
// GitHub release published from main must always be newer than the last one.
// Bump major/minor in package.json by hand; the patch number comes from CI.
const fs = require('node:fs')
const path = require('node:path')

const run = process.env.GITHUB_RUN_NUMBER
if (!run) throw new Error('GITHUB_RUN_NUMBER is not set (this script is for CI).')

const file = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
const [major, minor] = pkg.version.split('.')
pkg.version = `${major}.${minor}.${run}`
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
console.log(`version ${pkg.version}`)
