#!/usr/bin/env node
'use strict';
// Security Client Cleaner — CLI 프런트엔드.
// GUI(Electron)와 동일한 core/ 로직(scanner, remover)을 공유한다.
const readline = require('readline');
const { scan } = require('./core/scanner');
const { remove } = require('./core/remover');

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Set(argv.filter((a) => a.startsWith('-')));
const ids = argv.slice(1).filter((a) => !a.startsWith('-'));
const JSONOUT = flags.has('--json');
const ALL = flags.has('--all');
const YES = flags.has('--yes') || flags.has('-y');

const C = process.stdout.isTTY
  ? { b: '\x1b[1m', dim: '\x1b[2m', g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', x: '\x1b[0m' }
  : { b: '', dim: '', g: '', y: '', r: '', x: '' };

function help() {
  console.log(`${C.b}Security Client Cleaner (CLI)${C.x}
한국 금융/공공기관 강제설치 보안 클라이언트 탐지·제거 도구.

사용법:
  scc <명령> [클라이언트ID...] [옵션]

명령:
  list            전체 카탈로그와 설치 여부 표시
  scan            설치 탐지된 클라이언트만 표시 (기본)
  plan [ID...]    삭제 시 실행될 명령 미리보기 (dry-run, 변경 없음)
  remove [ID...]  실제 삭제 (ID 생략 시 설치된 전체)

옵션:
  --all           미설치 항목도 포함해 표시
  --json          결과를 JSON으로 출력
  -y, --yes       remove 시 확인 프롬프트 생략
  -h, --help      도움말

예:
  scc scan
  scc plan
  scc remove veraport delfino
  scc remove            # 설치된 전체 삭제 (확인 후, 관리자 권한 필요)

참고: 은행/공공 사이트 재접속 시 자동 재설치될 수 있습니다.`);
}

function printResults(results, showAll = ALL) {
  const shown = results.filter((r) => r.installed || showAll);
  if (JSONOUT) { console.log(JSON.stringify(shown, null, 2)); return; }
  if (!shown.length) { console.log(`${C.g}설치된 대상 보안 클라이언트가 없습니다.${C.x}`); return; }
  for (const r of shown) {
    const badge = r.installed ? `${C.g}●설치됨${C.x}` : `${C.dim}○미설치${C.x}`;
    console.log(`${badge}  ${C.b}${r.name}${C.x} ${C.dim}[${r.vendor}] (${r.id})${C.x}`);
    for (const e of r.evidence) console.log(`         ${C.dim}${e}${C.x}`);
  }
}

function pickSelected(results) {
  const installed = results.filter((r) => r.installed);
  if (!ids.length) return installed;
  const set = new Set(ids);
  return installed.filter((r) => set.has(r.id));
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(/^(y|yes)$/i.test(ans.trim())); });
  });
}

async function main() {
  if (!cmd || cmd === 'help' || flags.has('-h') || flags.has('--help')) return help();

  const results = await scan();

  if (cmd === 'list') { printResults(results, true); return; }
  if (cmd === 'scan') { printResults(results); return; }

  if (cmd === 'plan') {
    const items = pickSelected(results);
    if (!items.length) { console.log('대상이 없습니다.'); return; }
    const plan = await remove(items, { dryRun: true });
    if (JSONOUT) { console.log(JSON.stringify(plan, null, 2)); return; }
    console.log(`${C.y}# DRY-RUN — 아래 명령이 실제 삭제 시 실행됩니다 (지금은 변경 없음)${C.x}\n`);
    console.log(plan.commands.join('\n'));
    return;
  }

  if (cmd === 'remove') {
    const items = pickSelected(results);
    if (!items.length) { console.log('삭제할 대상이 없습니다.'); return; }
    console.log(`${C.b}삭제 대상 (${items.length}):${C.x}`);
    items.forEach((r) => console.log(`  • ${r.name} ${C.dim}(${r.id})${C.x}`));
    if (!YES) {
      const ok = await confirm(`${C.r}정말 삭제할까요? 관리자 비밀번호(sudo)가 필요합니다. [y/N]: ${C.x}`);
      if (!ok) { console.log('취소했습니다.'); return; }
    }
    const elevate = process.platform === 'win32' ? 'none' : 'sudo';
    const res = await remove(items, { dryRun: false, elevate });
    if (res.ok) console.log(`${C.g}✅ 삭제 완료.${C.x} 자동 재설치 가능성에 유의하세요.`);
    else console.log(`${C.r}❌ 실패: ${res.error || ''}${C.x}`);
    return;
  }

  console.error(`알 수 없는 명령: ${cmd}\n`);
  help();
  process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
