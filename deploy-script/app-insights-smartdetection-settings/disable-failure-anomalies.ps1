param(
    [Parameter(Mandatory = $true)][string]$AppInsightsName,
    [Parameter(Mandatory = $true)][string]$AppInsightsResourceGroupName,
    [Parameter(Mandatory = $true)][string]$SubscriptionId,
    [string]$RuleName,
    [string[]]$ActionGroupResourceIds = @(),
    [string]$TemplateFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot

if (-not $TemplateFile) {
    $TemplateFile = Join-Path $scriptRoot "failure-anomalies-disable.template.json"
}

try {
    $TemplateFile = (Resolve-Path -LiteralPath $TemplateFile -ErrorAction Stop).ProviderPath
} catch {
    throw "ARM template file '$TemplateFile' was not found."
}

if (-not $RuleName) {
    $RuleName = "Failure Anomalies - $AppInsightsName"
}

$appInsightsResourceId = "/subscriptions/$SubscriptionId/resourceGroups/$AppInsightsResourceGroupName/providers/microsoft.insights/components/$AppInsightsName"

$tempParamFile = $null
try {
    $tempParamFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), ("failure-anomalies-params-{0}.json" -f [System.Guid]::NewGuid().ToString("n")))

    $paramsObject = [PSCustomObject]@{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = [PSCustomObject]@{
            ruleName              = [PSCustomObject]@{ value = $RuleName }
            appInsightsResourceId = [PSCustomObject]@{ value = $appInsightsResourceId }
            actionGroupResourceIds = [PSCustomObject]@{ value = $ActionGroupResourceIds }
        }
    }

    $paramsJson = $paramsObject | ConvertTo-Json -Depth 10
    $paramsJson | Set-Content -LiteralPath $tempParamFile -Encoding utf8

    $smartDetectionArm = $TemplateFile

    Write-Host ("Disabling Failure Anomalies smart detector alert '{0}' (RG: {1})" -f $RuleName, $AppInsightsResourceGroupName) -ForegroundColor Cyan

    az deployment group create `
        --resource-group $AppInsightsResourceGroupName `
        --template-file $smartDetectionArm `
        --parameters @$tempParamFile `
        --mode Incremental | Out-Null

    Write-Host "Failure Anomalies alert disabled (state=Disabled)." -ForegroundColor Cyan
} finally {
    if ($tempParamFile -and (Test-Path -LiteralPath $tempParamFile)) {
        Remove-Item -LiteralPath $tempParamFile -Force -ErrorAction SilentlyContinue
    }
}
