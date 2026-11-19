/* Run from apps/command-hub: node src/modules/openmetadata/lineage-graph/benchmark.cjs [--dpr=2] */
const { mkdtemp, realpath, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const dpr = process.argv.includes('--dpr=2') ? 2 : 1

async function runNode() {
  const tempRoot = await realpath(tmpdir())
  const work = await mkdtemp(path.join(tempRoot, 'monorail-lineage-'))
  try {
    const { build } = await import('vite')
    const entry = path.join(__dirname, 'benchmark.html')
    const output = path.join(work, 'build')
    await build({
      root: path.resolve(__dirname, '../../../..'),
      publicDir: false,
      resolve: { preserveSymlinks: true },
      logLevel: 'warn',
      build: { outDir: output, emptyOutDir: false, rolldownOptions: { input: entry } },
    })
    const html = path.join(output, 'src/modules/openmetadata/lineage-graph/benchmark.html')
    const electron = require('electron')
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    await new Promise((resolve, reject) => {
      const child = spawn(electron, [__filename, `--benchmark-html=${html}`, `--benchmark-data=${work}`, `--dpr=${dpr}`, ...process.argv.filter((arg) => arg === '--checks-only')], {
        stdio: 'inherit',
        windowsHide: true,
        env,
      })
      child.on('error', reject)
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Electron benchmark exited with code ${code}`)))
    })
  } finally {
    const target = await realpath(work)
    if (path.dirname(target) === tempRoot && path.basename(target).startsWith('monorail-lineage-')) {
      await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 })
    }
  }
}

async function runElectron() {
  const { app, BrowserWindow } = require('electron')
  const argument = (name) => process.argv.find((arg) => arg.startsWith(name + '='))?.slice(name.length + 1)
  app.setPath('userData', argument('--benchmark-data'))
  app.commandLine.appendSwitch('force-device-scale-factor', String(dpr))
  await app.whenReady()
  const win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: 1280,
    height: 720,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  })
  win.webContents.setFrameRate(60)
  const timeout = setTimeout(() => {
    console.error('Lineage benchmark timed out')
    app.exit(1)
  }, 90000)
  try {
    await win.loadFile(argument('--benchmark-html'))
    const checksOnly = process.argv.includes('--checks-only')
    const results = await win.webContents.executeJavaScript(`window.${checksOnly ? 'runLineageChecks' : 'runLineageBenchmark'}(${dpr})`)
    console.log(JSON.stringify({
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      gpu: app.getGPUFeatureStatus(),
      ...results,
    }, null, 2))
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    clearTimeout(timeout)
  }
}

if (process.versions.electron) {
  runElectron().catch((error) => {
    console.error(error)
    require('electron').app.exit(1)
  })
} else {
  runNode().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
