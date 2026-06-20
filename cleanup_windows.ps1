<#
.SYNOPSIS
  한국 금융/공공기관 강제설치 보안 클라이언트 일괄 정리 (Windows)

.DESCRIPTION
  레지스트리 언인스톨 키를 DisplayName 패턴으로 탐지 → 공식 언인스톨러를 무인(silent) 옵션으로 실행
  → 관련 서비스 중지/삭제 → 잔여 폴더(Program Files / ProgramData) 정리.
  기본은 DRY-RUN(미리보기). 실제 삭제는 -Apply. 관리자 권한 PowerShell에서 실행하세요.

.EXAMPLE
  .\cleanup_windows.ps1                 # 미리보기 (변경 없음)
  .\cleanup_windows.ps1 -Apply          # 실제 삭제 (항목마다 확인)
  .\cleanup_windows.ps1 -Apply -Force   # 확인 없이 삭제
  .\cleanup_windows.ps1 -List           # 대상 카탈로그 출력
#>
[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$Force,
  [switch]$List
)

$ErrorActionPreference = 'SilentlyContinue'

# 카탈로그 (clients.json 미러)
$Clients = @(
  @{ Id='ahnlab-astx';   Name='AhnLab Safe Transaction (ASTx)';      Display=@('AhnLab Safe Transaction','ASTx');        Services=@('ASTx');            Residual=@('AhnLab\Safe Transaction','AhnLab\ASTx') }
  @{ Id='ahnlab-aos';    Name='AhnLab Online Security';              Display=@('AhnLab Online Security','AhnLab','AOS'); Services=@('AhnLab');          Residual=@('AhnLab\ASP') }
  @{ Id='touchen-nxkey'; Name='TouchEn nxKey (키보드 보안)';          Display=@('TouchEn nxKey','nxKey');                 Services=@('nxKey');           Residual=@('RaonSecure\TouchEn nxKey','TouchEn nxKey') }
  @{ Id='touchen-nxfw';  Name='TouchEn nxFirewall';                  Display=@('nxFirewall','TouchEn nxFirewall');       Services=@('nxFirewall');      Residual=@('RaonSecure\nxFirewall') }
  @{ Id='raon-crossex';  Name='CrossEX / CrossWeb / CrossWarpEX';    Display=@('CrossEX','CrossWeb','CrossWarp');         Services=@('CrossEX','CrossWeb'); Residual=@('RaonSecure\CrossEX','CrossEX') }
  @{ Id='nprotect';      Name='nProtect Online Security / Netizen';  Display=@('nProtect','INCA');                       Services=@('nProtect','npkc');  Residual=@('INCAInternet','nProtect') }
  @{ Id='delfino';       Name='Delfino (델피노)';                     Display=@('Delfino');                              Services=@('Delfino');         Residual=@('SOMANSA\Delfino','Delfino') }
  @{ Id='veraport';      Name='Veraport (베라포트)';                  Display=@('Veraport','Wizvera');                    Services=@('Veraport');        Residual=@('Wizvera\Veraport20','Wizvera') }
  @{ Id='ipinside';      Name='IPInside (아이피인사이드)';            Display=@('IPinside','IPInside');                   Services=@('IPinside');        Residual=@('IPinside') }
  @{ Id='inisafe';       Name='INISAFE (이니세이프) 시리즈';          Display=@('INISAFE','Initech');                     Services=@('INISAFE');         Residual=@('Initech\INISAFE','INISAFE') }
  @{ Id='anysign';       Name='AnySign4PC (전자서명)';                Display=@('AnySign','SoftForum');                   Services=@('AnySign');         Residual=@('SoftForum','AnySign') }
)

$DryRun = -not $Apply

function Write-Head($t) { Write-Host "`n$t" -ForegroundColor Cyan }
function Write-Dim($t)  { Write-Host "   $t" -ForegroundColor DarkGray }

# 레지스트리 언인스톨 키 전체 수집 (32/64bit + 사용자)
function Get-UninstallEntries {
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  Get-ItemProperty $roots | Where-Object { $_.DisplayName }
}

if ($List) {
  Write-Head '대상 보안 클라이언트 카탈로그 (Windows)'
  $Clients | ForEach-Object { Write-Host ('  • {0}' -f $_.Name) }
  return
}

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host '경고: 관리자 권한이 아닙니다. 일부 삭제가 실패할 수 있습니다. 관리자 PowerShell에서 다시 실행하세요.' -ForegroundColor Yellow
}

Write-Head '한국 보안 클라이언트 정리 도구 (Windows)'
if ($DryRun) {
  Write-Host '모드: DRY-RUN (미리보기 전용 — 아무것도 변경하지 않습니다). 실제 삭제는 -Apply' -ForegroundColor Yellow
} else {
  Write-Host '모드: APPLY (실제 삭제)' -ForegroundColor Red
}

$entries = Get-UninstallEntries
$progFiles = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData) | Where-Object { $_ }
$foundAny = $false
$removed = 0

foreach ($c in $Clients) {
  # 1) 매칭되는 언인스톨 엔트리 탐색
  $matches = $entries | Where-Object {
    $dn = $_.DisplayName
    ($c.Display | Where-Object { $dn -like "*$_*" }).Count -gt 0
  }
  # 잔여 폴더 존재 여부도 설치 신호로 사용
  $residualPaths = foreach ($r in $c.Residual) { foreach ($pf in $progFiles) { Join-Path $pf $r } }
  $residualExisting = $residualPaths | Where-Object { Test-Path $_ }

  if (-not $matches -and -not $residualExisting) { continue }

  $foundAny = $true
  Write-Host "`n▶ $($c.Name)" -ForegroundColor White
  $matches | ForEach-Object { Write-Dim "발견(레지스트리): $($_.DisplayName)" }
  $residualExisting | ForEach-Object { Write-Dim "발견(폴더): $_" }

  if (-not $DryRun -and -not $Force) {
    $ans = Read-Host '   삭제할까요? [y/N]'
    if ($ans -notmatch '^(y|yes)$') { Write-Dim '건너뜀'; continue }
  }

  # 2) 공식 언인스톨러 실행
  foreach ($m in $matches) {
    $cmd = $m.QuietUninstallString
    if (-not $cmd) { $cmd = $m.UninstallString }
    if (-not $cmd) { continue }
    # MSI는 무인 플래그 보강
    if ($cmd -match 'msiexec') {
      $cmd = ($cmd -replace '/I', '/X') + ' /quiet /norestart'
    }
    if ($DryRun) {
      Write-Host "   [dry-run] $cmd" -ForegroundColor Yellow
    } else {
      Write-Host "   공식 언인스톨러 실행: $cmd" -ForegroundColor Green
      try { Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -Wait -NoNewWindow } catch {}
    }
  }

  # 3) 서비스 중지/삭제
  foreach ($svcPat in $c.Services) {
    Get-Service -Name "*$svcPat*" 2>$null | ForEach-Object {
      if ($DryRun) {
        Write-Host "   [dry-run] Stop+Delete service: $($_.Name)" -ForegroundColor Yellow
      } else {
        Write-Host "   서비스 제거: $($_.Name)" -ForegroundColor Green
        Stop-Service -Name $_.Name -Force 2>$null
        & sc.exe delete $_.Name | Out-Null
      }
    }
  }

  # 4) 잔여 폴더 정리
  foreach ($p in $residualExisting) {
    if ($DryRun) {
      Write-Host "   [dry-run] Remove-Item -Recurse -Force `"$p`"" -ForegroundColor Yellow
    } else {
      Write-Host "   잔여 폴더 삭제: $p" -ForegroundColor Green
      Remove-Item -LiteralPath $p -Recurse -Force 2>$null
    }
  }

  $removed++
}

if (-not $foundAny) {
  Write-Host "`n설치된 대상 보안 클라이언트를 찾지 못했습니다. 정리할 것이 없습니다." -ForegroundColor Green
} elseif ($DryRun) {
  Write-Host "`n위 항목들이 -Apply 시 정리됩니다." -ForegroundColor Yellow
} else {
  Write-Host "`n정리 완료: $removed개 클라이언트 처리." -ForegroundColor White
  Write-Dim '참고: 은행/공공 사이트 재접속 시 자동 재설치될 수 있습니다.'
}
