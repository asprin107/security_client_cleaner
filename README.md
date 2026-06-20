# 한국 보안 클라이언트 일괄 정리 도구

한국 금융·공공기관 사이트가 강제 설치하는 보안 클라이언트(안랩 ASTx, nProtect, TouchEn,
Veraport, INISAFE, Delfino, IPInside, AnySign 등)를 탐지하고 제거하는 크로스플랫폼 도구입니다.

이들 클라이언트는 반복적으로 심각한 취약점(예: nProtect Netizen 원격코드실행, INISAFE
CrossWeb EX 공급망 공격)의 통로가 되어 왔으며, KISA·과기정통부도 구버전 보안 SW를 탐지·
삭제하는 "보안 취약점 클리닝 서비스"를 운영하고 있습니다.

## 아키텍처

**하나의 핵심 로직(`app/src/core/`)** 위에 **GUI와 CLI 두 프런트엔드**가 올라간 구조입니다.
(이전의 독립 bash/PowerShell 스크립트는 폐기됨 — 코드 중복으로 인한 탐지 결과 불일치 제거)

```
app/
  clients.json            ← 대상 클라이언트 카탈로그 (단일 진실 공급원)
  src/core/               ← Electron 비의존 순수 Node 로직 (탐지·삭제)
    catalog.js scanner.js remover.js
  src/main/ + renderer/   ← GUI (Electron)
  src/cli.js              ← CLI (동일한 core/ 사용)
  test/scan.js            ← 코어 단독 검증
```

> GUI와 CLI는 같은 `scanner.js`를 쓰므로 **탐지 결과가 항상 동일**합니다.

## 탐지·삭제 방식

1. **탐지** — macOS: 설치 경로 + launchd plist(데몬/에이전트 잔재 포함) / Windows: 레지스트리 언인스톨 키 + 폴더
2. **공식 언인스톨러 실행** — 각 제조사 공식 언인스톨러 우선 호출
3. **잔여물 정리** — LaunchDaemons/LaunchAgents(macOS)·서비스(Windows) 중지·삭제 후 남은 폴더 제거

## 사용법

```bash
cd app
npm install

# CLI
npm run cli -- scan            # 설치 탐지 결과
npm run cli -- list            # 전체 카탈로그
npm run cli -- plan            # 삭제 명령 미리보기 (dry-run, 변경 없음)
npm run cli -- remove          # 실제 삭제 (확인 후 sudo)
npm run cli -- remove veraport delfino   # 특정 항목만

# GUI
npm start
```

CLI를 `scc` 명령으로 전역 설치하려면 `npm link` (또는 `npm i -g .`) 후 `scc scan` 등으로 사용.

자세한 실행/패키징/문제해결은 [`app/README.md`](app/README.md) 참고.

## ⚠️ 반드시 알아둘 점

- **자동 재설치됩니다.** 은행/공공/카드 사이트 재접속 시 다시 설치됩니다. 이 도구는 일회성
  정리이며 근본 해결이 아닙니다.
- **서비스 이용에 지장이 생길 수 있습니다.** 실제 사용하는 인터넷뱅킹/전자서명 기능이
  동작하지 않을 수 있습니다. `scan`/`list`로 확인 후 필요한 항목은 제외하세요.
- **관리자 권한 필요.** 삭제 시 sudo(macOS) 또는 관리자 권한(Windows)이 필요합니다.
- **Windows 경로는 Windows에서 검증 필요** — 레지스트리 조회는 PowerShell 기반이라 macOS에서
  테스트 불가.

## 대상 클라이언트 추가/수정

`app/clients.json` 한 곳만 수정하면 GUI·CLI·테스트에 모두 반영됩니다.

## 출처

- 경로/언인스톨러 맵: [MacSAFER plugins.json](https://github.com/kyujin-cho/MacSAFER/blob/master/plugins.json)
- 안랩 공식 삭제 가이드: <https://help.ahnlab.com/astx/1.0/en_us/uninstall.htm>
- KISA 보안 취약점 클리닝 서비스: <https://www.kisa.or.kr/402/form?postSeq=2550>
