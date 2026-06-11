/**
 * Electron main entry. Owns the app window with a strict security baseline
 * (see CLAUDE.md): contextIsolation on, nodeIntegration off, sandbox on. The
 * renderer reaches the outside world only through the preload bridge + IPC.
 */
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { registerMediaScheme, registerMediaProtocol } from './media/protocol'
import { closeProjectDb } from './db'

const isDev = !app.isPackaged

// Must be registered before the app is ready.
registerMediaScheme()

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#16171b',
    title: 'Storyline',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Open any external links (e.g. the ComfyUI escape hatch) in the OS browser,
  // never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (isDev && devUrl) {
    void win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerMediaProtocol()
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  closeProjectDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeProjectDb()
})
