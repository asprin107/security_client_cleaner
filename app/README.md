# Security Client Cleaner — 앱 (Electron GUI + CLI)

`clients.json` 카탈로그를 공유하는 **단일 핵심 로직(`core/`) + 두 프런트엔드(GUI·CLI)**
구조입니다. 설치된 보안 클라이언트를 보고, 미리보기(dry-run) 후 선택 삭제합니다.

## 구조

```
app/
  clients.json     # 대상 클라이언트 카탈로그 (단일 진실 공급원)
  src/
    core/          # Electron 비의존 순수 Node 로직 (GUI·CLI 공통, 단독 테스트 가능)
      catalog.js   #   clients.json 로드
      scanner.js   #   설치 탐지 (macOS: 경로+launchd / Windows: 레지스트리+폴더)
      remover.js   #   삭제 명령 생성 + 권한상승 실행 (GUI=sudo-prompt, CLI=터미널 sudo)
    main/
      main.js      # Electron 메인 프로세스 + IPC
      preload.js   # contextBridge (안전한 API 노출)
    renderer/
      index.html   # GUI (다크 테마, 임베디드 CSS)
      renderer.js  # GUI 로직
    cli.js         # CLI 프런트엔드 (scc 명령)
  test/scan.js     # 코어 단독 검증: node test/scan.js
```

설계 핵심: **스캐너/삭제 로직을 프런트엔드와 분리**해, GUI와 CLI가 동일한 탐지 결과를
보장하고 `node test/scan.js`로 GUI 없이도 검증할 수 있습니다.

## CLI

```bash
npm run cli -- scan      # 설치 탐지
npm run cli -- list      # 전체 카탈로그
npm run cli -- plan      # dry-run 명령 미리보기
npm run cli -- remove    # 실제 삭제 (확인 후 sudo)
# 전역 설치: npm link  →  scc scan
```

## 실행

```bash
cd app
npm install          # electron + sudo-prompt
npm test             # GUI 없이 코어 검증 (현재 설치된 클라이언트 + dry-run 명령 출력)
npm start            # 앱 실행
```

### ⚠️ Electron 바이너리 설치 문제 (이 환경 특이사항)

이 머신에서는 npm의 install-script 차단(allow-scripts)으로 Electron postinstall이
바이너리를 정상 추출하지 못해, `dist`가 비정상(220KB 스텁)으로 남는 현상이 있었습니다.
`Electron failed to install correctly` 또는 `Electron Framework.framework (no such file)`
오류가 나면 캐시 zip을 수동으로 풀어 넣으세요:

```bash
cd app
ZIP=$(find "$HOME/Library/Caches/electron" -name "electron-v*darwin-*.zip" | head -1)
rm -rf node_modules/electron/dist
mkdir -p node_modules/electron/dist
unzip -q "$ZIP" -d node_modules/electron/dist
printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
npm start
```

(zip 캐시가 없으면 `node node_modules/electron/install.js`로 먼저 내려받습니다.)

## 사용 흐름

1. 앱 실행 → 자동 스캔 → 설치된 클라이언트가 "설치됨" 배지와 함께 표시
2. 지울 항목 체크 (또는 "전체 선택")
3. **미리보기 (dry-run)** — 실제 실행될 명령을 확인 (변경 없음)
4. **선택 삭제** — 확인 모달 → 관리자 비밀번호 1회 입력 → 공식 언인스톨러 + 잔여물 정리
5. 삭제 후 자동 재스캔

## 패키징 (배포용 .dmg / .exe)

```bash
npm i -D electron-builder
npm run dist        # mac: dmg, win: nsis. clients.json 이 리소스로 동봉됨
```

## 동작/주의

- **권한 상승**: 삭제 시 `sudo-prompt`로 한 번만 비밀번호/UAC를 요청하고, 선택 항목 전체를
  하나의 스크립트로 실행합니다.
- **Windows**: 레지스트리 언인스톨 키를 PowerShell로 조회해 탐지하므로, Windows에서
  실행·검증해야 합니다(이 코드의 Windows 경로는 macOS에서 테스트 불가).
- **자동 재설치**: 은행/공공 사이트 재접속 시 다시 설치될 수 있습니다(루트 README 참고).
