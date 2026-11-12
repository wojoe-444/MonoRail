import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite'
import { createRequire } from 'node:module'

const { bridgeClientScript } = createRequire(import.meta.url)('./electron/bridge/client-script.cjs') as {
  bridgeClientScript: (opts: { platform: string; remote?: boolean }) => string
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// Set by scripts/dev-browser.cjs (`npm run dev:browser`): the page talks to the
// real backends through the window-less Electron bridge (electron/dev-bridge.cjs).
const bridgeToken = process.env.MONORAIL_BRIDGE_TOKEN
const bridgePort = process.env.MONORAIL_BRIDGE_PORT || '5198'

// Defines window.commandHub in the page the way the Electron preload does, but
// over HTTP to /__bridge (proxied to the bridge). Never overrides a real
// preload, so `npm run desktop` is unaffected (electron/bridge/client-script.cjs).
const bridgeClient = bridgeClientScript({ platform: process.platform })

function devBridge(): Plugin {
  return {
    name: 'monorail-dev-bridge',
    apply: 'serve',
    transformIndexHtml: () => [{ tag: 'script', children: bridgeClient, injectTo: 'head-prepend' }],
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(bridgeToken ? [devBridge()] : [])],
  // Shown in the drawer footer. CI stamps package.json before it builds the installer.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Keep function names in the production build so Developer Mode's element
  // inspector can name React components (src/components/dev/inspect.ts).
  build: { rolldownOptions: { output: { keepNames: true } } },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // The Wiki module bundles the repo's docs/ folder (outside this app's root).
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(import.meta.dirname, '../../docs')] },
    proxy: bridgeToken
      ? {
          '/__bridge': {
            target: `http://127.0.0.1:${bridgePort}`,
            headers: { 'x-monorail-bridge-token': bridgeToken },
          },
        }
      : undefined,
  },
})
