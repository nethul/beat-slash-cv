/**
 * Beat Slash – Electron Main Process
 * GPU-accelerated desktop window with Python hand tracker subprocess management.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Enable GPU acceleration flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow = null;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#050508',
    show: false,
    title: 'Beat Slash',
    icon: path.join(__dirname, '..', 'assets', '.aistudio', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,    // Never throttle game rendering
      enableWebSQL: false,
      spellcheck: false,
    },
  });

  // Remove default menu
  mainWindow.setMenuBarVisibility(false);

  // Load the Vite dev server or built files
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev) {
    const port = process.env.VITE_PORT || 3000;
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fullscreen toggle with F11
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopPythonServer();
  });
}

function startPythonServer() {
  if (pythonProcess) return;

  const pythonScript = path.join(__dirname, '..', 'hand_tracker_server.py');

  // Try multiple Python paths to find one with mediapipe installed
  const pythonCandidates = process.platform === 'win32'
    ? [
        // System Python installations (where pip installed the deps)
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
        'python',
        'python3',
        'py',
      ]
    : ['python3', 'python'];

  let pythonCmd = pythonCandidates[0];
  for (const candidate of pythonCandidates) {
    try {
      const { execSync } = require('child_process');
      execSync(`"${candidate}" -c "import mediapipe"`, { stdio: 'ignore', timeout: 5000 });
      pythonCmd = candidate;
      console.log(`[Electron] Found Python with mediapipe: ${candidate}`);
      break;
    } catch {
      continue;
    }
  }

  console.log(`[Electron] Starting Python hand tracker: ${pythonCmd} ${pythonScript}`);

  pythonProcess = spawn(pythonCmd, [pythonScript], {
    cwd: path.join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  pythonProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[Python] ${msg}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[Python ERR] ${msg}`);
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[Electron] Python process exited with code ${code}`);
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error(`[Electron] Failed to start Python: ${err.message}`);
    pythonProcess = null;
  });
}

function stopPythonServer() {
  if (!pythonProcess) return;

  console.log('[Electron] Stopping Python hand tracker...');

  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill to ensure child processes are killed
      spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
    } else {
      pythonProcess.kill('SIGTERM');
    }
  } catch (e) {
    console.error('[Electron] Error stopping Python:', e.message);
  }

  pythonProcess = null;
}

// IPC handlers for renderer
ipcMain.handle('get-python-status', () => {
  return {
    running: pythonProcess !== null && pythonProcess.exitCode === null,
    pid: pythonProcess?.pid || null,
  };
});

ipcMain.handle('restart-python', () => {
  stopPythonServer();
  setTimeout(startPythonServer, 500);
  return { restarting: true };
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-fullscreen', () => {
  mainWindow?.setFullScreen(!mainWindow?.isFullScreen());
});

// App lifecycle
app.whenReady().then(() => {
  startPythonServer();

  // Give Python server a moment to start
  setTimeout(createWindow, 800);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopPythonServer();
  app.quit();
});

app.on('before-quit', () => {
  stopPythonServer();
});
