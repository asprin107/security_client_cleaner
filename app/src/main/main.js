'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { scan } = require('../core/scanner');
const { remove } = require('../core/remover');

let lastScan = []; // id -> scan item 매핑용 캐시

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: 'Security Client Cleaner',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

function pickSelected(ids) {
  const set = new Set(ids);
  return lastScan.filter((r) => r.installed && set.has(r.id));
}

// IPC: 스캔
ipcMain.handle('scan', async () => {
  lastScan = await scan();
  return { platform: process.platform, results: lastScan };
});

// IPC: dry-run 미리보기 (선택 항목의 삭제 명령)
ipcMain.handle('plan', async (_e, ids) => {
  const items = pickSelected(ids);
  return remove(items, { dryRun: true });
});

// IPC: 실제 삭제 (권한 상승 1회 프롬프트)
ipcMain.handle('remove', async (_e, ids) => {
  const items = pickSelected(ids);
  if (!items.length) return { executed: false, error: '선택된 항목이 없습니다.' };
  return remove(items, { dryRun: false });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
