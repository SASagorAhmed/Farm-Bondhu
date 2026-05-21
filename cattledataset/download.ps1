# Download cattle model + dataset to D:\FarmBondhu\cattledataset only (never C:)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:KAGGLEHUB_CACHE = Join-Path $PSScriptRoot "data"
$env:TEMP = Join-Path $PSScriptRoot "tmp"
$env:TMP = $env:TEMP
$env:PIP_CACHE_DIR = Join-Path $PSScriptRoot ".pip-cache"

@($env:KAGGLEHUB_CACHE, $env:TEMP, $env:PIP_CACHE_DIR) | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}

Write-Host "KAGGLEHUB_CACHE: $env:KAGGLEHUB_CACHE"
Write-Host "TEMP: $env:TEMP"
python download_dataset.py
