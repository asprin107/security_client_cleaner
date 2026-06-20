#!/usr/bin/env bash
#
# cleanup_macos.sh — 한국 금융/공공기관 강제설치 보안 클라이언트 일괄 정리 (macOS)
#
# 동작: 설치 탐지 → 공식 언인스톨러 실행(있으면) → 잔여 파일/LaunchAgents/LaunchDaemons 정리
# 기본은 DRY-RUN(미리보기). 실제 삭제하려면 --apply.
#
# 사용법:
#   ./cleanup_macos.sh            # 무엇이 삭제될지 미리보기 (아무것도 변경 안 함)
#   ./cleanup_macos.sh --apply    # 실제 삭제 (항목마다 y/N 확인)
#   ./cleanup_macos.sh --apply --force   # 확인 없이 삭제
#   ./cleanup_macos.sh --list     # 대상 카탈로그만 출력
#
# 잔여물(LaunchDaemons 등) 정리에는 sudo가 필요할 수 있어 자동으로 권한을 요청합니다.

set -uo pipefail

DRY_RUN=1
FORCE=0
LIST_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --apply) DRY_RUN=0 ;;
    --force) FORCE=1 ;;
    --list)  LIST_ONLY=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -n 18
      exit 0 ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 2 ;;
  esac
done

# 색상
if [ -t 1 ]; then
  C_BOLD=$'\033[1m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_BOLD=""; C_RED=""; C_GRN=""; C_YEL=""; C_DIM=""; C_RST=""
fi

# 카탈로그 (clients.json 미러). 필드: id|이름|탐지경로(;)|언인스톨러|잔여경로(;)|launchd패턴(;)
CLIENTS=(
"ahnlab-astx|AhnLab Safe Transaction (ASTx)|/Applications/AhnLab/ASTx|/Applications/AhnLab/ASTx/astxUninstaller|/Applications/AhnLab/ASTx;/Library/Application Support/AhnLab|com.ahnlab"
"ahnlab-aos|AhnLab Online Security 방화벽|/Applications/AhnLab/ASP/Firewall|/Applications/AhnLab/ASP/Firewall/ahnlabfwUninstaller|/Applications/AhnLab/ASP|com.ahnlab"
"touchen-nxkey|TouchEn nxKey (키보드 보안)|/Applications/TouchEn nxKey|/Applications/TouchEn nxKey/TKUninstall.app/Contents/MacOS/TKUninstall|/Applications/TouchEn nxKey|com.raon;nxkey;touchen"
"touchen-nxfw|TouchEn nxFirewall|/Applications/raonsecure/TouchEnnxFirewall||/Applications/raonsecure/TouchEnnxFirewall|com.raon;nxfirewall;touchen"
"raon-crossex|CrossEX / CrossWeb / CrossWarpEX|/Applications/CrossEX;/Applications/CrossWeb;/Applications/CrossWebEX;/Applications/CrossWarpEX||/Applications/CrossEX;/Applications/CrossWeb;/Applications/CrossWebEX;/Applications/CrossWarpEX|com.raon;crossex;crossweb"
"nprotect|nProtect Online Security / Netizen|/Applications/nProtect;/Applications/nProtect Netizen|/Applications/nProtect/nosuninst|/Applications/nProtect;/Applications/nProtect Netizen|com.inca;nprotect;npkc"
"delfino|Delfino (델피노)|/Applications/Delfino||/Applications/Delfino|delfino;com.somansa"
"veraport|Veraport (베라포트)|/Applications/Veraport||/Applications/Veraport|com.wizvera;veraport"
"ipinside|IPInside (아이피인사이드)|/Applications/NWS_IPinside|/Applications/NWS_IPinside/NWSUninstaller|/Applications/NWS_IPinside|ipinside;nws"
"inisafe|INISAFE (이니세이프) 시리즈|/Applications/INISAFE MoaSign EX Uninstaller;/Applications/INISAFE MoaSign S Uninstaller||/Applications/INISAFE MoaSign EX Uninstaller;/Applications/INISAFE MoaSign S Uninstaller|inisafe;com.initech"
"anysign|AnySign4PC (전자서명)|/Applications/SoftForum||/Applications/SoftForum|anysign;com.softforum;com.pentasecurity"
)

LAUNCHD_DIRS=("/Library/LaunchDaemons" "/Library/LaunchAgents" "$HOME/Library/LaunchAgents")

# --- 헬퍼 ---
say()  { printf '%s\n' "$*"; }
info() { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RST"; }

# 명령 실행: dry-run이면 출력만, apply면 실제 실행. sudo 필요 명령은 SUDO 접두.
SUDO=""
need_sudo() { if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '   %s[dry-run]%s %s\n' "$C_YEL" "$C_RST" "$*"
  else
    printf '   %s$%s %s\n' "$C_DIM" "$C_RST" "$*"
    eval "$@"
  fi
}

confirm() {
  [ "$FORCE" -eq 1 ] && return 0
  [ "$DRY_RUN" -eq 1 ] && return 0
  printf '   %s삭제할까요? [y/N]:%s ' "$C_BOLD" "$C_RST"
  read -r ans </dev/tty
  case "$ans" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# launchd 패턴에 맞는 plist 언로드 + 삭제
clean_launchd() {
  local patterns="$1" dir f base
  local IFS=';'
  for pat in $patterns; do
    for dir in "${LAUNCHD_DIRS[@]}"; do
      [ -d "$dir" ] || continue
      for f in "$dir"/*"$pat"*.plist; do
        [ -e "$f" ] || continue
        base="$(basename "$f" .plist)"
        run "$SUDO launchctl bootout system \"$f\" 2>/dev/null || $SUDO launchctl unload \"$f\" 2>/dev/null || true"
        run "$SUDO rm -f \"$f\""
      done
    done
  done
}

# --list 모드
if [ "$LIST_ONLY" -eq 1 ]; then
  say "${C_BOLD}대상 보안 클라이언트 카탈로그 (macOS)${C_RST}"
  for rec in "${CLIENTS[@]}"; do
    IFS='|' read -r id name detect uninst residual launchd <<< "$rec"
    printf '  • %-38s %s%s%s\n' "$name" "$C_DIM" "$detect" "$C_RST"
  done
  exit 0
fi

# --- 메인 ---
need_sudo

say ""
say "${C_BOLD}한국 보안 클라이언트 정리 도구 (macOS)${C_RST}"
if [ "$DRY_RUN" -eq 1 ]; then
  say "${C_YEL}모드: DRY-RUN (미리보기 전용 — 아무것도 변경하지 않습니다). 실제 삭제는 --apply${C_RST}"
else
  say "${C_RED}모드: APPLY (실제 삭제)${C_RST}"
  [ -n "$SUDO" ] && say "${C_DIM}일부 작업에 관리자 권한이 필요합니다. 처음 한 번 sudo 비밀번호를 입력해 두겠습니다.${C_RST}" && sudo -v
fi
say ""

found_any=0
removed=0

for rec in "${CLIENTS[@]}"; do
  IFS='|' read -r id name detect uninst residual launchd <<< "$rec"

  # 설치 여부 탐지
  installed=0
  IFS=';' read -ra detect_paths <<< "$detect"
  for p in "${detect_paths[@]}"; do
    [ -e "$p" ] && installed=1 && break
  done
  [ "$installed" -eq 0 ] && continue

  found_any=1
  say "${C_BOLD}▶ $name${C_RST}"
  for p in "${detect_paths[@]}"; do [ -e "$p" ] && info "   발견: $p"; done

  if ! confirm; then
    say "   ${C_DIM}건너뜀${C_RST}"; say ""; continue
  fi

  # 1) 공식 언인스톨러 (있으면)
  if [ -n "$uninst" ] && [ -e "$uninst" ]; then
    say "   ${C_GRN}공식 언인스톨러 실행${C_RST}"
    run "$SUDO \"$uninst\" 2>/dev/null || true"
  fi

  # 2) launchd 정리
  clean_launchd "$launchd"

  # 3) 잔여 파일 정리
  IFS=';' read -ra residual_paths <<< "$residual"
  for p in "${residual_paths[@]}"; do
    if [ -e "$p" ]; then
      run "$SUDO rm -rf \"$p\""
    fi
  done

  removed=$((removed+1))
  say "   ${C_GRN}완료${C_RST}"
  say ""
done

if [ "$found_any" -eq 0 ]; then
  say "${C_GRN}설치된 대상 보안 클라이언트를 찾지 못했습니다. 정리할 것이 없습니다.${C_RST}"
else
  if [ "$DRY_RUN" -eq 1 ]; then
    say "${C_YEL}위 항목들이 --apply 시 정리됩니다.${C_RST}"
  else
    say "${C_BOLD}정리 완료: ${removed}개 클라이언트 처리.${C_RST}"
    say "${C_DIM}참고: 은행/공공 사이트 재접속 시 자동 재설치될 수 있습니다.${C_RST}"
  fi
fi
