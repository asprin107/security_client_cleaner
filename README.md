# 한국 보안 클라이언트 일괄 정리 도구

한국 금융·공공기관 사이트가 강제 설치하는 보안 클라이언트(안랩 ASTx, nProtect, TouchEn,
Veraport, INISAFE, Delfino, IPInside, AnySign 등)를 탐지하고 일괄 제거하는
크로스플랫폼 스크립트입니다.

이들 클라이언트는 반복적으로 심각한 취약점(예: nProtect Netizen 원격코드실행, INISAFE
CrossWeb EX 공급망 공격)의 통로가 되어 왔으며, KISA·과기정통부도 구버전 보안 SW를 탐지·
삭제하는 "보안 취약점 클리닝 서비스"를 운영하고 있습니다.

## 구성

| 파일 | 설명 |
|---|---|
| `clients.json` | 대상 클라이언트 카탈로그 (단일 진실 공급원). 두 스크립트가 이 목록을 미러링 |
| `cleanup_macos.sh` | macOS용 (bash, 의존성 없음) |
| `cleanup_windows.ps1` | Windows용 (PowerShell 5+) |

## 동작 방식

1. **탐지** — 설치 경로(macOS) 또는 레지스트리 언인스톨 키 + 폴더(Windows)로 설치 여부 확인
2. **공식 언인스톨러 실행** — 각 제조사 공식 언인스톨러를 우선 호출 (가장 안전)
3. **잔여물 정리** — LaunchDaemons/LaunchAgents(macOS) 또는 서비스(Windows) 중지·삭제 후 남은 폴더 제거

> **기본은 DRY-RUN(미리보기)입니다.** 실제 삭제는 명시적으로 `--apply`/`-Apply`를 줘야 합니다.

## 사용법 (macOS)

```bash
./cleanup_macos.sh            # 무엇이 삭제될지 미리보기 (변경 없음)
./cleanup_macos.sh --list     # 대상 카탈로그만 출력
./cleanup_macos.sh --apply    # 실제 삭제 (항목마다 y/N 확인)
./cleanup_macos.sh --apply --force   # 확인 없이 일괄 삭제
```

잔여물(`/Library/LaunchDaemons` 등) 정리에 관리자 권한이 필요하면 자동으로 sudo를 요청합니다.

## 사용법 (Windows)

**관리자 권한 PowerShell**에서 실행하세요. 최초 1회 실행 정책 허용이 필요할 수 있습니다:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass   # 현재 세션만 허용
.\cleanup_windows.ps1            # 미리보기 (변경 없음)
.\cleanup_windows.ps1 -List      # 대상 카탈로그 출력
.\cleanup_windows.ps1 -Apply     # 실제 삭제 (항목마다 확인)
.\cleanup_windows.ps1 -Apply -Force   # 확인 없이 일괄 삭제
```

## ⚠️ 반드시 알아둘 점

- **자동 재설치됩니다.** 은행/공공/카드 사이트에 재접속하면 해당 사이트가 클라이언트를
  다시 설치합니다. 이 도구는 일회성 정리이며, 근본 해결이 아닙니다. 계속 깨끗이 유지하려면
  해당 사이트 사용을 줄이거나 별도 브라우저/프로파일로 분리하세요.
- **서비스 이용에 지장이 생길 수 있습니다.** 실제로 사용하는 인터넷뱅킹/전자서명/공인인증
  기능이 동작하지 않을 수 있습니다. 필요한 클라이언트는 `--list`로 확인 후 제외하세요.
- **관리자 권한 필요.** 데몬/서비스/시스템 경로 정리에는 sudo(macOS) 또는 관리자
  PowerShell(Windows)이 필요합니다.
- **공식 언인스톨러 우선.** 강제 파일 삭제보다 제조사 언인스톨러를 먼저 실행해 안전하게
  제거하고, 그 후 남은 잔여물만 정리합니다.

## 대상 클라이언트 추가/제외

`clients.json`이 기준 목록입니다. 항목을 추가하려면 해당 OS 스크립트의 카탈로그
(`cleanup_macos.sh`의 `CLIENTS` 배열, `cleanup_windows.ps1`의 `$Clients`)에도
같은 형식으로 추가하세요.

## 출처

- 경로/언인스톨러 맵: [MacSAFER plugins.json](https://github.com/kyujin-cho/MacSAFER/blob/master/plugins.json)
- 안랩 공식 삭제 가이드: <https://help.ahnlab.com/astx/1.0/en_us/uninstall.htm>
- KISA 보안 취약점 클리닝 서비스: <https://www.kisa.or.kr/402/form?postSeq=2550>
