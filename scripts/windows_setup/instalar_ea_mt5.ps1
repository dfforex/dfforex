$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$eaSrc = Join-Path $Root "mt5\DF_Forex_Pro_Bridge.mq5"
Write-Host "Instalando EA Bridge no MT5..." -ForegroundColor Cyan
$base = Join-Path $env:APPDATA "MetaQuotes\Terminal"
$folders = @()
if (Test-Path $base) {
  Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $experts = Join-Path $_.FullName "MQL5\Experts"
    if (Test-Path $experts) { $folders += $experts }
  }
}
if ($folders.Count -eq 0) {
  Write-Host "Nao encontrei MQL5\Experts automaticamente." -ForegroundColor Yellow
  Write-Host "Copie manualmente este arquivo para MQL5\Experts:" -ForegroundColor Yellow
  Write-Host $eaSrc -ForegroundColor White
  exit 0
}
$target = $folders[0]
if ($folders.Count -gt 1) {
  for ($i=0; $i -lt $folders.Count; $i++) { Write-Host "[$($i+1)] $($folders[$i])" }
  $choice = Read-Host "Escolha o numero, ou ENTER para primeira"
  if ($choice -match '^[0-9]+$') {
    $idx=[int]$choice-1
    if ($idx -ge 0 -and $idx -lt $folders.Count) { $target=$folders[$idx] }
  }
}
Copy-Item $eaSrc (Join-Path $target "DF_Forex_Pro_Bridge.mq5") -Force
Write-Host "EA copiado para $target" -ForegroundColor Green
Write-Host "No MT5, atualize o Navegador/Experts, arraste o EA para o grafico e libere WebRequest para https://df-forex.netlify.app" -ForegroundColor Yellow
