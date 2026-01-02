param(
    [Parameter(Mandatory = $true)][string]$AppInsightsName,
    [Parameter(Mandatory = $true)][string]$AppInsightsResourceGroupName,
    [string]$TemplateFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot

if (-not $TemplateFile) {
    $TemplateFile = Join-Path $scriptRoot "smart-detection-disable-rules.template.json"
}

try {
    $TemplateFile = (Resolve-Path -LiteralPath $TemplateFile -ErrorAction Stop).ProviderPath
} catch {
    throw "ARM template file '$TemplateFile' was not found."
}

$tempParamFile = $null
try {
    $tempParamFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), ("smart-detection-params-{0}.json" -f [System.Guid]::NewGuid().ToString("n")))

    $paramsObject = [PSCustomObject]@{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = [PSCustomObject]@{
            appInsightsName = [PSCustomObject]@{ value = $AppInsightsName }
        }
    }

    $paramsJson = $paramsObject | ConvertTo-Json -Depth 10
    $paramsJson | Set-Content -LiteralPath $tempParamFile -Encoding utf8

    $smartDetectionArm = $TemplateFile

    Write-Host ("Disabling Smart Detection rules for '{0}' (RG: {1})" -f $AppInsightsName, $AppInsightsResourceGroupName) -ForegroundColor Cyan

    az deployment group create `
        --resource-group $AppInsightsResourceGroupName `
        --template-file $smartDetectionArm `
        --parameters @$tempParamFile `
        --mode Incremental | Out-Null

    Write-Host "Smart Detection rules disabled." -ForegroundColor Cyan
} finally {
    if ($tempParamFile -and (Test-Path -LiteralPath $tempParamFile)) {
        Remove-Item -LiteralPath $tempParamFile -Force -ErrorAction SilentlyContinue
    }
}
