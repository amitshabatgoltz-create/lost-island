// Desktop shell: runs the built web game (app/) in its own window.
// Files are served through a custom app:// scheme instead of file:// so that
// ES modules, fetch() of the .glb model and localStorage saves all work.
const { app, BrowserWindow, protocol, net, Menu } = require('electron');
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
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
