import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite'
import { createRequire } from 'node:module'
import { frontMatter, parseWikiIndex, plainText } from './src/modules/wiki/document.ts'

const { bridgeClientScript } = createRequire(import.meta.url)('./electron/bridge/client-script.cjs') as {
  bridgeClientScript: (opts: { platform: string; remote?: boolean }) => string
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const docsDir = path.resolve(import.meta.dirname, '../../docs')

/** Derive the Wiki's two indexes from the same docs the renderer loads on demand. */
function wikiIndexes(): Plugin {
  return {
    name: 'monorail-wiki-indexes',
    load(id) {
      const match = /^(.*\.md)\?(wiki-meta|wiki-text)$/.exec(id)
      if (!match) return
      const [, file, kind] = match
      const relative = path.relative(docsDir, file)
      if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return
      const pageId = relative.split(path.sep).join('/').slice(0, -3)
      this.addWatchFile(file)
      const markdown = readFileSync(file, 'utf8')
      const value = kind === 'wiki-meta' ? parseWikiIndex(pageId, markdown) : plainText(frontMatter(markdown).body)
      return `export default ${JSON.stringify(value)}`
    },
  }
}

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

// The file:// renderer needs its CSP in the document. Keep index.html for the
// phone server, which injects its own bridge and sends its own CSP header.
function desktopEntry(): Plugin {
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // Email's srcdoc inherits this policy and adds its own image opt-in.
    "img-src 'self' data: blob: monorail-ext: https: http:",
    "font-src 'self' data:",
    "connect-src 'none'",
    // Extension pages, email srcdoc, and Chat's sandboxed Browser panel.
    'frame-src monorail-ext: about: https: http:',
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')

  return {
    name: 'monorail-desktop-entry',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const entry = bundle['index.html']
        if (entry?.type !== 'asset' || typeof entry.source !== 'string' || !entry.source.includes('<head>')) {
          this.error('Could not find the built renderer HTML for the desktop CSP.')
        }
        this.emitFile({
          type: 'asset',
          fileName: 'desktop.html',
          source: entry.source.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`),
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), wikiIndexes(), desktopEntry(), ...(bridgeToken ? [devBridge()] : [])],
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
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), docsDir] },
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
