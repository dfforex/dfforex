param(
  [switch]$Silent
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

function Write-Title($txt) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host " $txt" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Step($txt) { Write-Host "`n[INFO] $txt" -ForegroundColor Green }
function Write-Warn($txt) { Write-Host "`n[AVISO] $txt" -ForegroundColor Yellow }
function Write-Err($txt) { Write-Host "`n[ERRO] $txt" -ForegroundColor Red }

function Test-Command($cmd) {
  try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

function Install-WithWinget($id, $name) {
  if (-not (Test-Command winget)) {
    Write-Warn "winget nao encontrado. Instale $name manualmente e rode novamente."
    return $false
  }
  Write-Step "Instalando $name via winget..."
  winget install --id $id --accept-package-agreements --accept-source-agreements --silent
  return $true
}

function Ensure-Git {
  if (Test-Command git) {
    Write-Step "Git encontrado: $(git --version)"
    return
  }
  Write-Warn "Git nao encontrado. Tentando instalar automaticamente..."
  Install-WithWinget "Git.Git" "Git"
  if (-not (Test-Command git)) { throw "Git ainda nao encontrado apos instalacao. Feche e abra o terminal, ou instale Git manualmente." }
}

function Ensure-Node {
  if (Test-Command node) {
    $v = node -v
    Write-Step "Node encontrado: $v"
    return
  }
  Write-Warn "Node.js nao encontrado. Tentando instalar Node.js LTS automaticamente..."
  Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
  if (-not (Test-Command node)) { throw "Node.js ainda nao encontrado apos instalacao. Feche e abra o terminal, ou instale Node.js manualmente." }
}

function Ensure-NpmInstall {
  Write-Step "Instalando dependencias Node do projeto..."
  if (-not (Test-Path (Join-Path $Root "package.json"))) { throw "package.json nao encontrado em $Root" }
  npm install
  Write-Step "Validando build do projeto..."
  npm run build
}

function Read-OrDefault($prompt, $default) {
  if ($default) { $val = Read-Host "$prompt [$default]" } else { $val = Read-Host $prompt }
  if ([string]::IsNullOrWhiteSpace($val)) { return $default }
  return $val.Trim()
}

function New-BridgeSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes)).Replace('+','').Replace('/','').Replace('=','')
}

function Ensure-Env {
  Write-Step "Preparando .env local seguro..."
  $envPath = Join-Path $Root ".env"
  if (Test-Path $envPath) {
    Write-Warn ".env ja existe. Nao vou sobrescrever."
    return
  }

  $siteUrl = Read-OrDefault "PUBLIC_SITE_URL" "https://df-forex.netlify.app"
  $supabaseUrl = Read-OrDefault "SUPABASE_URL local (opcional; pode deixar vazio se usar so Netlify)" ""
  $serviceKey = Read-OrDefault "SUPABASE_SERVICE_ROLE_KEY local (opcional; NUNCA subir ao GitHub)" ""
  $bridgeId = Read-OrDefault "MT5_BRIDGE_ID" "df-forex-main"
  $bridgeSecret = Read-OrDefault "MT5_BRIDGE_SECRET (enter para gerar automaticamente)" ""
  if ([string]::IsNullOrWhiteSpace($bridgeSecret)) { $bridgeSecret = New-BridgeSecret }
  $mt5Server = Read-OrDefault "MT5_SERVER" "Deriv-Demo"
  $mt5Login = Read-OrDefault "MT5_LOGIN (opcional)" ""

  $content = @"
# DF Forex Pro v3.3 - Ambiente local
# Nao subir este arquivo para o GitHub.
PUBLIC_SITE_URL=$siteUrl

SUPABASE_URL=$supabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
SUPABASE_ANON_KEY=

BROKER_CONNECTOR=mt5_bridge
MT5_BRIDGE_ID=$bridgeId
MT5_BRIDGE_SECRET=$bridgeSecret
MT5_SERVER=$mt5Server
MT5_LOGIN=$mt5Login

BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
MT5_ALLOW_REAL_TRADING=false
MAX_RISK_PER_TRADE_PCT=0.5
MAX_DAILY_LOSS_PCT=2
MAX_WEEKLY_LOSS_PCT=5
MAX_MONTHLY_DRAWDOWN_PCT=10
"@
  Set-Content -Path $envPath -Value $content -Encoding UTF8
  Write-Step ".env criado com modo seguro: DEMO / DRY_RUN / SEM ORDEM REAL."
}

function Find-MetaTraderExpertsFolders {
  $folders = @()
  $base = Join-Path $env:APPDATA "MetaQuotes\Terminal"
  if (Test-Path $base) {
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $experts = Join-Path $_.FullName "MQL5\Experts"
      if (Test-Path $experts) { $folders += $experts }
    }
  }
  return $folders
}

function Find-MetaEditor {
  $candidates = @(
    "$env:ProgramFiles\MetaTrader 5\metaeditor64.exe",
    "$env:ProgramFiles(x86)\MetaTrader 5\metaeditor64.exe",
    "$env:LOCALAPPDATA\Programs\MetaTrader 5\metaeditor64.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  try {
    $found = Get-ChildItem -Path $env:ProgramFiles,$env:LOCALAPPDATA -Recurse -Filter metaeditor64.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  } catch {}
  return $null
}

function Install-EA {
  Write-Step "Instalando EA Bridge no MetaTrader 5..."
  $eaSrc = Join-Path $Root "mt5\DF_Forex_Pro_Bridge.mq5"
  if (-not (Test-Path $eaSrc)) { Write-Warn "EA nao encontrado em $eaSrc"; return }

  $folders = @(Find-MetaTraderExpertsFolders)
  if ($folders.Count -eq 0) {
    Write-Warn "Nao encontrei pasta MQL5\\Experts automaticamente."
    Write-Host "Abra o MetaTrader 5 > Arquivo > Abrir Pasta de Dados > MQL5 > Experts e copie manualmente:" -ForegroundColor Yellow
    Write-Host $eaSrc -ForegroundColor Yellow
    return
  }

  $targetFolder = $folders[0]
  if ($folders.Count -gt 1) {
    Write-Host "Foram encontradas varias pastas MQL5\\Experts:" -ForegroundColor Yellow
    for ($i=0; $i -lt $folders.Count; $i++) { Write-Host "[$($i+1)] $($folders[$i])" }
    $choice = Read-Host "Escolha o numero da pasta para instalar o EA, ou ENTER para usar a primeira"
    if ($choice -match '^[0-9]+$') {
      $idx = [int]$choice - 1
      if ($idx -ge 0 -and $idx -lt $folders.Count) { $targetFolder = $folders[$idx] }
    }
  }

  $eaDst = Join-Path $targetFolder "DF_Forex_Pro_Bridge.mq5"
  Copy-Item $eaSrc $eaDst -Force
  Write-Step "EA copiado para: $eaDst"

  $metaEditor = Find-MetaEditor
  if ($metaEditor) {
    Write-Step "MetaEditor encontrado. Tentando compilar o EA..."
    $log = Join-Path $Root "mt5_compile.log"
    Start-Process -FilePath $metaEditor -ArgumentList "/compile:`"$eaDst`"", "/log:`"$log`"" -Wait -WindowStyle Hidden
    if (Test-Path $log) { Write-Host "Log de compilacao: $log" -ForegroundColor Cyan }
  } else {
    Write-Warn "MetaEditor nao encontrado para compilar automaticamente. Compile pelo MetaEditor se necessario."
  }

  Write-Warn "No MetaTrader 5, libere WebRequest para: https://df-forex.netlify.app"
  Write-Host "Caminho: Ferramentas > Opcoes > Expert Advisors > Permitir WebRequest para URL listada." -ForegroundColor Yellow
}

function Open-LocalhostPrompt {
  $open = Read-Host "Deseja abrir o painel local agora em http://localhost:8787? Digite S para sim"
  if ($open -match '^[sS]') {
    Write-Step "Iniciando Netlify Dev em http://localhost:8787 ..."
    Start-Process "http://localhost:8787"
    npm run dev
  }
}

function Get-EnvFileValue($key, $fallback) {
  $envPath = Join-Path $Root ".env"
  if (Test-Path $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
    if ($line) {
      $value = $line.Substring($key.Length + 1)
      if (-not [string]::IsNullOrWhiteSpace($value)) { return $value.Trim() }
    }
  }
  return $fallback
}

function Write-NetlifyEnvFile {
  $out = Join-Path $Root "NETLIFY_ENV_COPIAR.txt"
  $siteUrl = Get-EnvFileValue "PUBLIC_SITE_URL" "https://df-forex.netlify.app"
  $supabaseUrl = Get-EnvFileValue "SUPABASE_URL" "SUA_URL_SUPABASE"
  $serviceKey = Get-EnvFileValue "SUPABASE_SERVICE_ROLE_KEY" "SUA_SERVICE_ROLE_KEY"
  $anonKey = Get-EnvFileValue "SUPABASE_ANON_KEY" "SUA_ANON_KEY_SE_USAR_NO_FRONT"
  $bridgeId = Get-EnvFileValue "MT5_BRIDGE_ID" "df-forex-main"
  $bridgeSecret = Get-EnvFileValue "MT5_BRIDGE_SECRET" "COLE_UM_SEGREDO_FORTE_AQUI"
  $mt5Server = Get-EnvFileValue "MT5_SERVER" "Deriv-Demo"
  $mt5Login = Get-EnvFileValue "MT5_LOGIN" "SEU_LOGIN_MT5"
  $brokerName = Get-EnvFileValue "MT5_BROKER_NAME" "Deriv MT5"
  $symbols = Get-EnvFileValue "FOREX_SYMBOLS" "EURUSD,GBPUSD,USDJPY,XAUUSD"

  $txt = @"
Copie estas variaveis no Netlify > Site configuration > Environment variables.
ATENCAO: credenciais provisorias para teste. Nao subir este arquivo ao GitHub.
Depois de validar funcionamento, troque/rotacione as chaves no Supabase e atualize no Netlify.

PUBLIC_SITE_URL=$siteUrl

SUPABASE_URL=$supabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
SUPABASE_ANON_KEY=$anonKey

BROKER_CONNECTOR=mt5_bridge
MT5_BRIDGE_ID=$bridgeId
MT5_BRIDGE_SECRET=$bridgeSecret
MT5_BROKER_NAME=$brokerName
MT5_SERVER=$mt5Server
MT5_LOGIN=$mt5Login
MT5_ALLOW_REAL_TRADING=false

BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false

FOREX_SYMBOLS=$symbols
MAX_RISK_PER_TRADE_PCT=0.5
MAX_DAILY_LOSS_PCT=2
MAX_WEEKLY_LOSS_PCT=5
MAX_MONTHLY_DRAWDOWN_PCT=10
MIN_SIGNAL_SCORE=80
MAX_TRADES_PER_DAY=5
MAX_OPEN_POSITIONS=2
"@
  Set-Content -Path $out -Value $txt -Encoding UTF8
  Write-Step "Arquivo de variaveis do Netlify criado/preenchido: $out"
}

Write-Title "DF Forex Pro v3.3 - Instalador completo Windows"
Write-Host "Este instalador prepara o painel Netlify/Node e instala o EA Bridge no MetaTrader 5 quando encontrado." -ForegroundColor White
Write-Host "Ele NAO habilita ordens reais. O modo inicial e DEMO / DRY_RUN." -ForegroundColor Yellow

try {
  Ensure-Git
  Ensure-Node
  Ensure-NpmInstall
  Ensure-Env
  Write-NetlifyEnvFile
  Install-EA
  Write-Step "Instalacao concluida."
  Write-Host ""
  Write-Host "Proximos passos obrigatorios:" -ForegroundColor Cyan
  Write-Host "1. Rode no Supabase: supabase/mt5_bridge_schema.sql" -ForegroundColor White
  Write-Host "2. Configure as variaveis no Netlify usando NETLIFY_ENV_COPIAR.txt" -ForegroundColor White
  Write-Host "3. No MT5, faca login na conta Deriv-Demo/Real." -ForegroundColor White
  Write-Host "4. Arraste o EA DF_Forex_Pro_Bridge para um grafico." -ForegroundColor White
  Write-Host "5. Configure no EA o mesmo MT5_BRIDGE_ID e MT5_BRIDGE_SECRET." -ForegroundColor White
  Write-Host "6. Teste primeiro em dry_run/demo." -ForegroundColor White
  Open-LocalhostPrompt
} catch {
  Write-Err $_.Exception.Message
  Write-Host "Se precisar, envie o print do erro para eu corrigir o instalador." -ForegroundColor Yellow
  exit 1
}
