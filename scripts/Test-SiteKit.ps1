#requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path -Parent $PSScriptRoot
$failures = 0
try {
    $manifest = Get-Content -LiteralPath (Join-Path $siteRoot 'docs/site-kit-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.schema_version -ne 1) { throw 'Unsupported manifest schema' }
    foreach ($file in $manifest.files) {
        if ([IO.Path]::IsPathRooted($file.path) -or $file.path -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Unsafe manifest path' }
        $path = Join-Path $siteRoot $file.path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Write-Output ('FAIL missing ' + $file.path); $failures++ }
        elseif ($file.immutable -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { Write-Output ('FAIL changed package ' + $file.path); $failures++ }
    }
    $lock = Get-Content -LiteralPath (Join-Path $siteRoot 'docs/skills-lock.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $names = @{}
    foreach ($skill in $lock.skills) {
        $body = Get-Content -LiteralPath (Join-Path $siteRoot ($skill.package_path + '/SKILL.md')) -Raw -Encoding UTF8
        $matched = $body -match '(?m)^name:\s*["'']?([a-z0-9-]+)["'']?\s*$'
        if (-not $matched) { throw ('Missing skill name: ' + $skill.name) }
        if ($Matches[1] -ne $skill.name -or $names.ContainsKey($skill.name)) { throw ('Invalid/duplicate skill metadata: ' + $skill.name) }
        $names[$skill.name] = $true
    }
} catch { Write-Output ('FAIL ' + $_.Exception.Message); $failures++ }
if ($failures -gt 0) { Write-Output ('RESULT FAIL=' + $failures); exit 1 }
Write-Output 'PASS Site kit files, package hashes and skill names. Application behavior NOT tested.'
exit 0
