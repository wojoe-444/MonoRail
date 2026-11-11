import { useCallback, useEffect, useState } from 'react'

/**
 * Full screen mode. In the desktop app it is the window's own full screen
 * (F11 or the top-bar button, see electron/window-fullscreen.cjs); in the
 * browser dev server it falls back to the page Fullscreen API.
 */
export function useFullScreen(): { fullScreen: boolean; toggle: () => void } {
  const bridge = typeof window !== 'undefined' ? window.commandHub : undefined
  const native = !!bridge?.toggleFullScreen
  const [fullScreen, setFullScreen] = useState(() => !native && typeof document !== 'undefined' && !!document.fullscreenElement)

  useEffect(() => {
    if (native) {
      let alive = true
      void bridge?.isFullScreen?.().then((v) => alive && setFullScreen(!!v))
      const off = bridge?.on?.('window:fullscreen', (v) => setFullScreen(!!v))
      return () => {
        alive = false
        off?.()
      }
    }
    const onChange = () => setFullScreen(!!document.fullscreenElement)
    // F11 is the browser's own full screen; this covers the button only.
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [bridge, native])

  const toggle = useCallback(() => {
    if (native) {
      void bridge?.toggleFullScreen?.().then((v) => setFullScreen(!!v))
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [bridge, native])

  return { fullScreen, toggle }
}
