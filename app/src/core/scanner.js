'use strict';
// 설치된 보안 클라이언트를 탐지하고, 삭제에 필요한 actionable 정보를 해석한다.
// Electron 비의존 — 순수 Node. node test/scan.js 로 단독 검증 가능.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { loadCatalog } = require('./catalog');

const HOME = os.homedir();
const MAC_LAUNCHD_DIRS = [
  '/Library/LaunchDaemons',
  '/Library/LaunchAgents',
  path.join(HOME, 'Library', 'LaunchAgents'),
];

function existing(paths) {
  return (paths || []).filter((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
}

// 패턴(부분문자열, 대소문자 무시)에 맞는 launchd plist 경로 수집 (macOS)
function findLaunchdFiles(patterns) {
  const pats = (patterns || []).map((s) => s.toLowerCase());
  const hits = [];
  for (const dir of MAC_LAUNCHD_DIRS) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch (_) { continue; }
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.plist')) continue;
      const low = name.toLowerCase();
      if (pats.some((p) => low.includes(p))) hits.push(path.join(dir, name));
    }
  }
  return hits;
}

function scanMac(clients) {
  return clients.map((c) => {
    const m = c.macos || {};
    const detected = existing(m.detect);
    const launchdFiles = findLaunchdFiles(m.launchd_patterns);
    const residual = existing(m.residual);
    const installed = detected.length > 0 || launchdFiles.length > 0;
    const evidence = [
      ...detected.map((p) => `앱: ${p}`),
      ...launchdFiles.map((p) => `데몬/에이전트: ${p}`),
    ];
    const uninstaller = (m.uninstaller && fs.existsSync(m.uninstaller)) ? m.uninstaller : null;
    return {
      id: c.id, name: c.name, vendor: c.vendor, platform: 'darwin',
      installed, evidence,
      actions: { uninstaller, launchdFiles, services: [], residual },
    };
  });
}

// Windows: 레지스트리 언인스톨 키를 powershell로 한 번에 읽어와 매칭
function readWindowsUninstallEntries() {
  return new Promise((resolve) => {
    const ps = [
      "$roots=@(",
      "'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');",
      "Get-ItemProperty $roots -ErrorAction SilentlyContinue |",
      "Where-Object {$_.DisplayName} |",
      "Select-Object DisplayName,UninstallString,QuietUninstallString |",
      "ConvertTo-Json -Compress",
    ].join(' ');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          const parsed = JSON.parse(stdout);
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (_) { resolve([]); }
      });
  });
}

function programDirs() {
  return [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter(Boolean);
}

async function scanWindows(clients) {
  const entries = await readWindowsUninstallEntries();
  return clients.map((c) => {
    const w = c.windows || {};
    const matched = entries.filter((e) =>
      (w.displayName_patterns || []).some((p) => (e.DisplayName || '').toLowerCase().includes(p.toLowerCase())));
    const residualPaths = [];
    for (const r of (w.residual || [])) for (const pd of programDirs()) residualPaths.push(path.join(pd, r));
    const residual = existing(residualPaths);
    const installed = matched.length > 0 || residual.length > 0;
    const evidence = [
      ...matched.map((e) => `레지스트리: ${e.DisplayName}`),
      ...residual.map((p) => `폴더: ${p}`),
    ];
    const uninstaller = matched
      .map((e) => e.QuietUninstallString || e.UninstallString)
      .filter(Boolean)[0] || null;
    return {
      id: c.id, name: c.name, vendor: c.vendor, platform: 'win32',
      installed, evidence,
      actions: {
        uninstaller,
        uninstallStrings: matched.map((e) => e.QuietUninstallString || e.UninstallString).filter(Boolean),
        launchdFiles: [],
        services: w.service_patterns || [],
        residual,
      },
    };
  });
}

async function scan() {
  const clients = loadCatalog();
  if (process.platform === 'win32') return scanWindows(clients);
  return scanMac(clients); // darwin (macOS)
}

module.exports = { scan };
