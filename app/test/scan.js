'use strict';
// 코어 로직 단독 검증 (Electron 불필요). 실행: node app/test/scan.js
const { scan } = require('../src/core/scanner');
const { remove } = require('../src/core/remover');

(async () => {
  const results = await scan();
  const installed = results.filter((r) => r.installed);

  console.log(`\n=== 스캔 결과 (platform=${process.platform}) ===`);
  console.log(`전체 카탈로그: ${results.length}종, 설치 탐지: ${installed.length}종\n`);

  for (const r of installed) {
    console.log(`▶ ${r.name}  [${r.vendor}]`);
    for (const e of r.evidence) console.log(`    ${e}`);
    if (r.actions.uninstaller) console.log(`    공식 언인스톨러: ${r.actions.uninstaller}`);
  }

  if (installed.length) {
    console.log('\n=== DRY-RUN 삭제 명령 미리보기 ===');
    const plan = await remove(installed, { dryRun: true });
    console.log(plan.commands.join('\n'));
  } else {
    console.log('설치된 대상 클라이언트가 없습니다.');
  }
})().catch((e) => { console.error(e); process.exit(1); });
