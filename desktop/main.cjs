// Desktop shell: runs the built web game (app/) in its own window.
// Files are served through a custom app:// scheme instead of file:// so that
// ES modules, fetch() of the .glb model and localStorage saves all work.
const { app, BrowserWindow, protocol, net, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'app');

// Laptops with two graphics chips: ask Windows for the strong one.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: true,
    backgroundColor: '#000000',
    title: 'LOST',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.loadURL('app://game/index.html');
  return win;
}

// Like Fortnite: on every launch, look for a newer version on the GitHub
// release page, download it in the background, then offer to restart.
// Only the installed (Setup) version can update itself, not the portable one.
function checkForUpdates(win) {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  autoUpdater.on('error', () => {}); // offline or no release yet: just play
  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'LOST',
      message: 'יש עדכון חדש למשחק!',
      detail: `גרסה ${info.version} מוכנה. להפעיל מחדש ולהתקין עכשיו? (אם לא, העדכון יותקן כשתסגור את המשחק)`,
      buttons: ['לעדכן עכשיו', 'אחר כך'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  checkForUpdates(createWindow());
});

app.on('window-all-closed', () => app.quit());
