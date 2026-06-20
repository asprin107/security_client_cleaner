'use strict';
// scan() 결과로부터 삭제 명령 목록을 만들고, 권한 상승하여 일괄 실행한다.
// dryRun 모드면 명령만 반환하고 아무것도 실행하지 않는다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function shq(s) { return `'${String(s).replace(/'/g, `'\\''`)}'`; } // bash 단일따옴표 이스케이프

// macOS: 클라이언트 하나에 대한 bash 명령 라인들
function macCommands(item) {
  const a = item.actions;
  const lines = [];
  lines.push(`echo "▶ ${item.name}"`);
  if (a.uninstaller) {
    lines.push(`echo "  - 공식 언인스톨러 실행"`);
    lines.push(`${shq(a.uninstaller)} >/dev/null 2>&1 || true`);
  }
  for (const f of a.launchdFiles) {
    lines.push(`launchctl bootout system ${shq(f)} 2>/dev/null || launchctl unload ${shq(f)} 2>/dev/null || true`);
    lines.push(`rm -f ${shq(f)}`);
  }
  for (const p of a.residual) {
    lines.push(`rm -rf ${shq(p)}`);
  }
  return lines;
}

// Windows: 클라이언트 하나에 대한 powershell 명령 라인들
function winCommands(item) {
  const a = item.actions;
  const lines = [];
  lines.push(`Write-Host "▶ ${item.name}"`);
  for (const cmd of (a.uninstallStrings || [])) {
    let c = cmd;
    if (/msiexec/i.test(c)) c = c.replace(/\/I/i, '/X') + ' /quiet /norestart';
    lines.push(`Write-Host "  - 공식 언인스톨러 실행"`);
    lines.push(`cmd /c ${JSON.stringify(c)} 2>$null`);
  }
  for (const svc of (a.services || [])) {
    lines.push(`Get-Service -Name "*${svc}*" -ErrorAction SilentlyContinue | ForEach-Object { Stop-Service $_.Name -Force -ErrorAction SilentlyContinue; sc.exe delete $_.Name | Out-Null }`);
  }
  for (const p of a.residual) {
    lines.push(`Remove-Item -LiteralPath ${JSON.stringify(p)} -Recurse -Force -ErrorAction SilentlyContinue`);
  }
  return lines;
}

// 선택된 항목들에 대한 전체 명령 라인 (플랫폼별)
function buildCommands(items) {
  const isWin = process.platform === 'win32';
  const out = [];
  for (const item of items) out.push(...(isWin ? winCommands(item) : macCommands(item)));
  return out;
}

// 권한 상승 일괄 실행. sudo-prompt 1회 프롬프트로 전체 스크립트 실행.
function execElevated(scriptPath, isWin) {
  const sudo = require('sudo-prompt');
  const cmd = isWin
    ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`
    : `/bin/bash "${scriptPath}"`;
  return new Promise((resolve) => {
    sudo.exec(cmd, { name: 'Security Client Cleaner' }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        error: err ? String(err.message || err) : null,
        stdout: stdout ? String(stdout) : '',
        stderr: stderr ? String(stderr) : '',
      });
    });
  });
}

// 터미널에서 직접 실행 (CLI용). stdio 상속 → sudo 비밀번호/출력이 터미널로 흐른다.
// elevate: 'sudo'(macOS, sudo 경유) | 'none'(현재 셸 권한 그대로, Windows는 관리자 셸 가정)
function execTerminal(scriptPath, isWin, elevate) {
  return new Promise((resolve) => {
    let cmd, args;
    if (isWin) {
      cmd = 'powershell.exe';
      args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
    } else if (elevate === 'sudo') {
      cmd = 'sudo';
      args = ['/bin/bash', scriptPath];
    } else {
      cmd = '/bin/bash';
      args = [scriptPath];
    }
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('close', (code) => resolve({ ok: code === 0, error: code === 0 ? null : `exit ${code}`, stdout: '', stderr: '' }));
    child.on('error', (e) => resolve({ ok: false, error: String(e.message || e), stdout: '', stderr: '' }));
  });
}

// 메인 진입점. items 는 scan() 결과 중 사용자가 선택한 항목들.
// elevate: 'gui'(Electron, sudo-prompt 대화상자) | 'sudo'(CLI, 터미널 sudo) | 'none'
async function remove(items, { dryRun = true, elevate = 'gui' } = {}) {
  const isWin = process.platform === 'win32';
  const lines = buildCommands(items);
  const header = isWin
    ? ['$ErrorActionPreference = "SilentlyContinue"']
    : ['#!/usr/bin/env bash', 'set -u'];
  const script = [...header, ...lines].join('\n') + '\n';

  if (dryRun) {
    return { dryRun: true, commands: lines, script, executed: false };
  }

  const ext = isWin ? 'ps1' : 'sh';
  const scriptPath = path.join(os.tmpdir(), `scc-remove-${process.pid}.${ext}`);
  fs.writeFileSync(scriptPath, script, { mode: 0o700 });
  try {
    const result = elevate === 'gui'
      ? await execElevated(scriptPath, isWin)
      : await execTerminal(scriptPath, isWin, elevate);
    return { dryRun: false, commands: lines, executed: true, ...result };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) {}
  }
}

module.exports = { buildCommands, remove };
