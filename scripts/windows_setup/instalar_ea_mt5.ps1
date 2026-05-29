$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

function Write-Step($m){ Write-Host "`n[INFO] $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "`n[AVISO] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "`n[ERRO] $m" -ForegroundColor Red }

$eaSrc = Join-Path $Root "mt5\DF_Forex_Pro_Bridge.mq5"
if (-not (Test-Path $eaSrc)) { throw "EA nao encontrado: $eaSrc" }

Write-Step "Instalando DF_Forex_Pro_Bridge.mq5 no MetaTrader 5..."
$base = Join-Path $env:APPDATA "MetaQuotes\Terminal"
$folders = @()
if (Test-Path $base) {
  Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $experts = Join-Path $_.FullName "MQL5\Experts"
    if (Test-Path $experts) { $folders += $experts }
  }
}

if ($folders.Count -eq 0) {
  Write-Warn "Nao encontrei nenhuma pasta MQL5\Experts automaticamente."
  Write-Host "No MT5: Arquivo > Abrir Pasta de Dados > MQL5 > Experts" -ForegroundColor Yellow
  Write-Host "Copie manualmente este arquivo:" -ForegroundColor Yellow
  Write-Host $eaSrc -ForegroundColor White
  exit 0
}

foreach ($target in $folders) {
  $dst = Join-Path $target "DF_Forex_Pro_Bridge.mq5"
  Copy-Item $eaSrc $dst -Force
  Write-Step "EA copiado para: $dst"
}

# Tenta encontrar MetaEditor para compilar. Se falhar, o usuário ainda pode compilar pelo MT5/MetaEditor.
$metaEditors = @()
$candidates = @(
  "$env:ProgramFiles\MetaTrader 5\metaeditor64.exe",
  "$env:ProgramFiles(x86)\MetaTrader 5\metaeditor64.exe",
  "$env:LOCALAPPDATA\Programs\MetaTrader 5\metaeditor64.exe"
)
foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { $metaEditors += $c } }
try {
  $found = Get-ChildItem -Path $env:ProgramFiles,$env:LOCALAPPDATA -Recurse -Filter metaeditor64.exe -ErrorAction SilentlyContinue | Select-Object -First 3
  foreach ($f in $found) { if ($f.FullName -notin $metaEditors) { $metaEditors += $f.FullName } }
} catch {}

if ($metaEditors.Count -gt 0) {
  $meta = $metaEditors[0]
  Write-Step "MetaEditor encontrado: $meta"
  foreach ($target in $folders) {
    $dst = Join-Path $target "DF_Forex_Pro_Bridge.mq5"
    $log = Join-Path $Root ("mt5_compile_" + ([IO.Path]::GetFileName((Split-Path $target -Parent))) + ".log")
    Write-Step "Tentando compilar: $dst"
    Start-Process -FilePath $meta -ArgumentList "/compile:`"$dst`"", "/log:`"$log`"" -Wait -WindowStyle Hidden
    if (Test-Path $log) { Write-Host "Log: $log" -ForegroundColor Cyan }
  }
} else {
  Write-Warn "MetaEditor nao encontrado. No MT5, clique com o direito em Experts e compile/atualize se necessario."
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " PROXIMOS PASSOS NO METATRADER 5" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "1. Feche e abra o MT5, ou clique com o direito no Navegador > Atualizar." -ForegroundColor White
Write-Host "2. Em Navegador > Expert Advisors, encontre DF_Forex_Pro_Bridge." -ForegroundColor White
Write-Host "3. Arraste para um grafico, por exemplo EURUSD H1." -ForegroundColor White
Write-Host "4. Marque: Permitir Algo Trading / Allow Algo Trading." -ForegroundColor White
Write-Host "5. Em Ferramentas > Opcoes > Expert Advisors, marque WebRequest e adicione:" -ForegroundColor White
Write-Host "   https://df-forex.netlify.app" -ForegroundColor Yellow
Write-Host "6. Verifique se o grafico mostra o texto: DF Forex Pro Bridge v3.4." -ForegroundColor White
Write-Host "7. O painel deve sair de Offline em ate 10 segundos." -ForegroundColor White
