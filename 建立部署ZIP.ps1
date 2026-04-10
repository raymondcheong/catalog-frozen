# 建立部署 ZIP（排除 node_modules 等）
# 若檔案被鎖定，會用 robocopy 複製到暫存目錄再壓縮

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$destZip = Join-Path $root 'deploy.zip'
$exclude = @('node_modules', '.git', '.netlify', 'deploy.zip', '.cursor', '建立部署ZIP.bat', '建立部署ZIP.ps1')

function Build-Zip {
    param([string]$fromPath)
    $items = Get-ChildItem -Path $fromPath -Force | Where-Object { $exclude -notcontains $_.Name }
    $paths = $items | ForEach-Object { $_.FullName }
    Compress-Archive -Path $paths -DestinationPath $destZip -Force
}

function Copy-WithRobocopy {
    $tempDir = Join-Path $env:TEMP "deploy-zip-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    $excludeDirs = @('node_modules', '.git', '.netlify', '.cursor')
    $excludeFiles = @('deploy.zip', '建立部署ZIP.bat', '建立部署ZIP.ps1')
    & robocopy $root $tempDir /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS | Out-Null
    return $tempDir
}

try {
    Build-Zip -fromPath $root
    exit 0
} catch {
    $msg = $_.Exception.Message
    if ($msg -match 'being used by another process|used by another') {
        Write-Host '部分檔案被其他程式使用，改以 robocopy 複製後壓縮...'
        $tempDir = $null
        try {
            $tempDir = Copy-WithRobocopy
            Build-Zip -fromPath $tempDir
        } finally {
            if ($tempDir -and (Test-Path $tempDir)) {
                Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        throw
    }
}
