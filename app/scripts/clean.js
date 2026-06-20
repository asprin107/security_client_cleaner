'use strict';
// 빌드 전 정리. (1) 실행 중인 앱을 종료해 번들 잠금을 풀고 (2) dist/ 를 제거한다.
// electron-builder 의 rename 충돌(앱 실행 중 잠금)·잔여 mac.tmp 로 인한 빌드/실행 실패 방지.
const { rmSync } = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1) 실행 중인 앱 인스턴스 종료 (best-effort)
try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM "Security Client Cleaner.exe"', { stdio: 'ignore' });
  } else {
    execSync("pkill -f 'Security Client Cleaner.app/Contents'", { stdio: 'ignore' });
  }
  console.log('[clean] 실행 중인 앱 인스턴스 종료');
} catch (_) { /* 실행 중이 아니면 무시 */ }

// 2) dist/ 제거 (일시적 경합 대비 재시도)
const dir = path.join(__dirname, '..', 'dist');
try {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  console.log('[clean] removed', dir);
} catch (e) {
  console.error('[clean] 경고: dist 제거 실패(빌드는 계속 진행됨):', e.message);
}
