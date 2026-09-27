# Uniprae universal Adobe MCP installer for Windows.
# Installs one cwd-independent MCP command and both Adobe CEP bridges.
param([switch]$EnableDeveloperExtensions, [switch]$AddToPath)
$ErrorActionPreference = "Stop"
$NodeExecutable = (Get-Command node -ErrorAction Stop).Source

$SourceRoot = $PSScriptRoot
$PanelSync = Join-Path $SourceRoot 'scripts\sync-panels.mjs'
if (Test-Path $PanelSync) {
    & $NodeExecutable $PanelSync
    if ($LASTEXITCODE -ne 0) { throw 'Shared panel synchronization failed' }
}
$ServerSource = Join-Path $SourceRoot "server"
if (-not (Test-Path $ServerSource)) { $ServerSource = Join-Path $SourceRoot "aftereffects-mcp" }
$ExtensionsSource = Join-Path $SourceRoot "extensions"
$PremiereExtension = Join-Path $ExtensionsSource "premiere_mcp_bridge"
$GroqExtension = Join-Path $ExtensionsSource "groq-transcriber"
$SilencerExtension = Join-Path $ExtensionsSource "video_silencer"
$AfterEffectsExtension = Join-Path $ExtensionsSource "aftereffects_mcp_bridge"
if (-not (Test-Path $PremiereExtension)) { $PremiereExtension = Join-Path $SourceRoot "premiere-mcp\extensions\premiere_mcp_bridge" }
if (-not (Test-Path $GroqExtension)) { $GroqExtension = Join-Path $SourceRoot "premiere-mcp\extensions\groq-transcriber" }
if (-not (Test-Path $SilencerExtension)) { $SilencerExtension = Join-Path $SourceRoot "premiere-mcp\extensions\video_silencer" }
$InstallRoot = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Uniprae"
$CepRoot = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "Adobe\CEP\extensions"
$CommandRoot = Join-Path $InstallRoot "bin"

Write-Host "Installing Uniprae..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $ServerSource "dist\index.js"))) {
    Push-Location $ServerSource
    try { npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }; npm run build; if ($LASTEXITCODE -ne 0) { throw 'Server build failed' } } finally { Pop-Location }
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $CepRoot, $CommandRoot | Out-Null
$ModulesSource = Join-Path $ServerSource "node_modules"
if (!(Test-Path $ModulesSource)) { $ModulesSource = Join-Path $SourceRoot "node_modules" }
function Copy-Contents($Source, $Destination) {
    if (!(Test-Path -LiteralPath $Source)) { throw "Missing installation source: $Source" }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}
Copy-Contents (Join-Path $ServerSource "dist") (Join-Path $InstallRoot "dist")
Copy-Contents $ModulesSource (Join-Path $InstallRoot "node_modules")
Copy-Item (Join-Path $ServerSource "package.json") (Join-Path $InstallRoot "package.json") -Force
$PremiereToolsSource = Join-Path $SourceRoot "premiere-tools"
if (-not (Test-Path $PremiereToolsSource)) { $PremiereToolsSource = Join-Path $SourceRoot "premiere-mcp\extensions" }
Copy-Contents $PremiereToolsSource (Join-Path $InstallRoot "premiere-tools")

$AeDestination = Join-Path $CepRoot "aftereffects_mcp_bridge"
$PproDestination = Join-Path $CepRoot "premiere_mcp_bridge"
$GroqDestination = Join-Path $CepRoot "groq_transcriber"
$SilencerDestination = Join-Path $CepRoot "video_silencer"
$BackupRoot = Join-Path $InstallRoot ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($Destination in @($AeDestination,$PproDestination,$GroqDestination,$SilencerDestination)) {
    if (Test-Path -LiteralPath $Destination) { Copy-Contents $Destination (Join-Path $BackupRoot (Split-Path $Destination -Leaf)) }
}
Copy-Contents $AfterEffectsExtension $AeDestination
Copy-Contents $PremiereExtension $PproDestination
Copy-Contents $GroqExtension $GroqDestination
Copy-Contents $SilencerExtension $SilencerDestination

$Launcher = Join-Path $CommandRoot "uniprae.cmd"
$NodeEntry = Join-Path $InstallRoot "dist\index.js"
Set-Content -Path $Launcher -Encoding Ascii -Value "@echo off`r`n`"$NodeExecutable`" `"$NodeEntry`" %*"
Set-Content -Path (Join-Path $CommandRoot "adobe-mcp.cmd") -Encoding Ascii -Value "@echo off`r`n`"$NodeExecutable`" `"$NodeEntry`" %*"

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathParts = @($UserPath -split ";" | Where-Object { $_ })
if ($AddToPath -and $PathParts -notcontains $CommandRoot) {
    [Environment]::SetEnvironmentVariable("Path", (($PathParts + $CommandRoot) -join ";"), "User")
}

if ($EnableDeveloperExtensions) { for ($Version = 7; $Version -le 20; $Version++) {
    $RegistryPath = "HKCU:\Software\Adobe\CSXS.$Version"
    if (-not (Test-Path $RegistryPath)) { New-Item -Path $RegistryPath -Force | Out-Null }
    Set-ItemProperty -Path $RegistryPath -Name "PlayerDebugMode" -Value "1" -Force
} }

$Config = @{
    mcpServers = @{
        uniprae = @{
            command = $NodeExecutable
            args = @($NodeEntry)
        }
    }
} | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $InstallRoot "mcp-config.example.json") -Value $Config -Encoding UTF8

# Install native client invocation routes.
$RouteSource = Join-Path $SourceRoot "client-routes"
if (Test-Path $RouteSource) {
    $CodexSkills = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".codex\skills"
    $ClaudeCommands = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".claude\commands"
    New-Item -ItemType Directory -Force -Path $CodexSkills, $ClaudeCommands | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $CodexSkills "ae"), (Join-Path $CodexSkills "pr") | Out-Null
    Copy-Item (Join-Path $RouteSource "codex\ae\SKILL.md") (Join-Path $CodexSkills "ae\SKILL.md") -Force
    Copy-Item (Join-Path $RouteSource "codex\pr\SKILL.md") (Join-Path $CodexSkills "pr\SKILL.md") -Force
    Copy-Item (Join-Path $RouteSource "claude\ae.md") (Join-Path $ClaudeCommands "ae.md") -Force
    Copy-Item (Join-Path $RouteSource "claude\pr.md") (Join-Path $ClaudeCommands "pr.md") -Force
}

$Registrar = Join-Path $SourceRoot "scripts\register-clients.mjs"
if (!(Test-Path $Registrar)) { throw "Missing client registration script: $Registrar" }
& $NodeExecutable $Registrar $NodeEntry
if ($LASTEXITCODE -ne 0) { throw "Client registration failed. Existing configuration backups have been retained." }
Write-Host "Uniprae installed and registered with Codex, Claude Code and Antigravity." -ForegroundColor Green
Write-Host "Command: uniprae"
Write-Host "Config example: $(Join-Path $InstallRoot 'mcp-config.example.json')"
Write-Host "Routes: Codex uses `$ae / `$pr; Claude Code uses /ae / /pr; MCP prompt clients expose ae / pr."
Write-Host "Restart After Effects, Premiere Pro, and your AI client before first use."
