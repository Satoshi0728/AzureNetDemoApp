param(
    [Parameter(Mandatory = $true)][string]$UniqueName,
    [string]$SubscriptionId,
    [string]$AcrName,
    [string]$WebAppResourceGroupName,
    [string]$AcrResourceGroupName,
    [string]$Location = "japaneast",
    [string]$AppServicePlanName,
    [string]$AppServicePlanSku = "F1",
    [string]$WebAppName,
    [string]$ImageName,
    [string]$ImageTag = ([DateTime]::UtcNow.AddHours(9).ToString("yyyyMMddHHmm")),
    [string]$DockerContext,
    [string]$Dockerfile,
    [string]$DockerPlatform = "linux/amd64",
    [string]$TargetPort = "8080",
    [string]$AcrSku = "Basic",
    # Include storage sharing opt-in by default for Linux custom containers
    [string[]]$EnvironmentVariables = @("NODE_ENV=production", "WEBSITES_ENABLE_APP_SERVICE_STORAGE=true"),
    [string]$HealthCheckPath = "/api/healthz",
    [string]$AppInsightsName,
    [string]$AppInsightsResourceGroupName,
    [string]$LogAnalyticsWorkspaceName,
    [string]$LogAnalyticsWorkspaceResourceGroupName,
    [switch]$UseExistingAppInsights,
    [object]$EnableAppInsights = $true,
    [object]$DisableIpMasking = $false,
    [switch]$EnableHealthCheck,
    [switch]$SkipDockerBuild,
    [switch]$SkipDockerPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$repoRoot = Split-Path -Path $scriptRoot -Parent

if (-not $PSBoundParameters.ContainsKey('DockerContext') -or [string]::IsNullOrWhiteSpace($DockerContext)) {
    $DockerContext = $repoRoot
}

if (-not $PSBoundParameters.ContainsKey('Dockerfile') -or [string]::IsNullOrWhiteSpace($Dockerfile)) {
    $Dockerfile = Join-Path $repoRoot "Dockerfile"
}

try {
    $DockerContext = (Resolve-Path -LiteralPath $DockerContext -ErrorAction Stop).ProviderPath
} catch {
    throw "Docker context path '$DockerContext' was not found. Run this script from the repository root or override -DockerContext."
}

try {
    $Dockerfile = (Resolve-Path -LiteralPath $Dockerfile -ErrorAction Stop).ProviderPath
} catch {
    throw "Dockerfile '$Dockerfile' was not found. Ensure the repository root contains Dockerfile or pass -Dockerfile."
}

function ConvertTo-BooleanInput {
    param(
        [Parameter(Mandatory = $false)][object]$Value,
        [bool]$Default = $false
    )

    if ($null -eq $Value) { return $Default }

    # Guard: handle array inputs (PowerShell can bind as object[] when multiple values are given).
    if ($Value -is [array]) {
        if ($Value.Count -eq 1) {
            $Value = $Value[0]
        } else {
            Write-Warning ("Unrecognized boolean input array '{0}'. Using default '{1}'." -f ($Value -join ','), $Default)
            return $Default
        }
    }

    $text = ("$Value").Trim().ToLowerInvariant()
    switch ($text) {
        "true"  { return $true }
        "false" { return $false }
        "1"     { return $true }
        "0"     { return $false }
        "yes"   { return $true }
        "no"    { return $false }
        default  {
            Write-Warning ("Unrecognized boolean input '{0}'. Using default '{1}'." -f $Value, $Default)
            return $Default
        }
    }
}

$healthCheckRequested = $true
if ($PSBoundParameters.ContainsKey('EnableHealthCheck')) {
    $healthCheckRequested = [bool]$EnableHealthCheck
}
$appInsightsRequested = $true
if ($PSBoundParameters.ContainsKey('EnableAppInsights')) {
    $appInsightsRequested = ConvertTo-BooleanInput -Value $EnableAppInsights -Default $true
}
$DisableIpMasking = ConvertTo-BooleanInput -Value $DisableIpMasking -Default $false
$logAnalyticsWorkspaceProvided = $PSBoundParameters.ContainsKey('LogAnalyticsWorkspaceName')

$script:ctrlCHandler = $null
$script:ctrlCHandlerRegistered = $false

try {
    $consoleType = [System.Type]::GetType("System.Console", $false)
    if (-not $consoleType) {
        $consoleType = [System.Console]
    }

    if ($consoleType -and $consoleType.GetEvent("CancelKeyPress")) {
        $script:ctrlCHandler = [System.ConsoleCancelEventHandler]{
            param(
                [object]$sourceObj,
                [System.ConsoleCancelEventArgs]$cancelEventArgs
            )
            $cancelEventArgs.Cancel = $true
            Write-Host ""
            Write-Host "Operation cancelled by user (Ctrl+C)." -ForegroundColor Yellow
            [System.Environment]::Exit(1)
        }
        [System.Console]::add_CancelKeyPress($script:ctrlCHandler)
        $script:ctrlCHandlerRegistered = $true
    }
} catch {
    Write-Verbose ("Ctrl+C handler not attached: {0}" -f $_)
}

try {

$appServicePlanProvided = $PSBoundParameters.ContainsKey('AppServicePlanName')
$webAppResourceGroupProvided = $PSBoundParameters.ContainsKey('WebAppResourceGroupName')

$trimmedUnique = ($UniqueName ?? "").Trim()
if ([string]::IsNullOrWhiteSpace($trimmedUnique)) {
    throw "UniqueName cannot be blank."
}

$lowerUnique = $trimmedUnique.ToLowerInvariant()
$safeName = ($lowerUnique -replace "[^a-z0-9-]", "-").Trim("-".ToCharArray())
if ([string]::IsNullOrWhiteSpace($safeName)) {
    throw "UniqueName '$UniqueName' does not contain any valid characters for resource naming."
}

$acrBase = ($lowerUnique -replace "[^a-z0-9]", "")
if ([string]::IsNullOrWhiteSpace($acrBase)) {
    $acrBase = "acr$($safeName -replace '-', '')"
}
if ($acrBase.Length -lt 5) {
    $acrBase = $acrBase.PadRight(5, '0')
}
if ($acrBase.Length -gt 45) {
    $acrBase = $acrBase.Substring(0, 45)
}

if (-not $ImageName) {
    $ImageName = "$safeName-app"
}
if (-not $WebAppName) {
    $WebAppName = "$safeName-webapp"
}
if (-not $AppServicePlanName) {
    $AppServicePlanName = "$safeName-plan"
}
if (-not $WebAppResourceGroupName) {
    $WebAppResourceGroupName = "rg-$safeName"
}
if (-not $AppInsightsName) {
    $AppInsightsName = "$safeName-appinsights"
}
if (-not $AcrName) {
    $AcrName = "$acrBase" + "acr"
}
if (-not [char]::IsLetter($AcrName[0])) {
    $AcrName = "a$AcrName"
}
if ($AcrName.Length -gt 50) {
    $AcrName = $AcrName.Substring(0, 50)
}

if (-not $SubscriptionId) {
    Write-Host "No subscription id provided. Detecting available contexts..." -ForegroundColor Yellow

    $selectionOptions = @()

    $cliSubscription = $null
    $cliSubscriptionJson = az account show --query "{id:id,name:name,tenant:tenantId}" --output json 2>$null
    if ($LASTEXITCODE -eq 0 -and $cliSubscriptionJson) {
        try {
            $cliSubscription = $cliSubscriptionJson | ConvertFrom-Json
        } catch {
            $cliSubscription = $null
        }
    }

    if ($cliSubscription) {
        $selectionOptions += [PSCustomObject]@{
            Label    = "Use Azure CLI default subscription"
            Id       = $cliSubscription.id
            Name     = $cliSubscription.name
            Tenant   = $cliSubscription.tenant
            IsCustom = $false
        }
    }

    $psContext = $null
    if (Get-Command Get-AzContext -ErrorAction SilentlyContinue) {
        try {
            $psContext = Get-AzContext -ErrorAction SilentlyContinue
        } catch {
            $psContext = $null
        }
    }

    if ($psContext -and $psContext.Subscription) {
        $selectionOptions += [PSCustomObject]@{
            Label    = "Use Azure PowerShell default subscription"
            Id       = $psContext.Subscription.Id
            Name     = $psContext.Subscription.Name
            Tenant   = $psContext.Tenant.Id
            IsCustom = $false
        }
    }

    $selectionOptions += [PSCustomObject]@{
        Label    = "Enter a different subscription id"
        Id       = $null
        Name     = $null
        Tenant   = $null
        IsCustom = $true
    }

    if ($selectionOptions.Count -eq 1) {
        Write-Host "No default subscriptions detected. Please enter a subscription id." -ForegroundColor Yellow
        do {
            $SubscriptionId = (Read-Host "Subscription Id").Trim()
        } while ([string]::IsNullOrWhiteSpace($SubscriptionId))
    } else {
        Write-Host ""
        for ($i = 0; $i -lt $selectionOptions.Count; $i++) {
            $option = $selectionOptions[$i]
            if ($option.IsCustom) {
                Write-Host ("[{0}] {1}" -f ($i + 1), $option.Label)
            } else {
                Write-Host ("[{0}] {1}: {2} ({3})" -f ($i + 1), $option.Label, $option.Name, $option.Id)
            }
        }

        $choice = $null
        do {
            $inputValue = Read-Host "Select subscription (1-$($selectionOptions.Count))"
            if ([int]::TryParse($inputValue, [ref]$choice)) {
                if ($choice -ge 1 -and $choice -le $selectionOptions.Count) {
                    break
                }
            }
            Write-Host "Invalid selection. Please enter a number between 1 and $($selectionOptions.Count)." -ForegroundColor Yellow
        } while ($true)

        $selectedOption = $selectionOptions[$choice - 1]
        if ($selectedOption.IsCustom) {
            do {
                $SubscriptionId = (Read-Host "Subscription Id").Trim()
            } while ([string]::IsNullOrWhiteSpace($SubscriptionId))
        } else {
            $SubscriptionId = $selectedOption.Id
            Write-Host ("Using subscription '{0}' ({1})" -f $selectedOption.Name, $selectedOption.Id) -ForegroundColor Cyan
        }
    }
}

function Invoke-DockerBuildAndPush {
    param(
        [string]$LocalTag,
        [string]$RemoteTag,
        [string]$ContextPath,
        [string]$DockerfilePath,
        [string]$Platform,
        [switch]$SkipBuild,
        [switch]$SkipPush
    )

    if (-not $SkipBuild) {
        Write-Host "Building Docker image $LocalTag" -ForegroundColor Cyan
        docker build --platform $Platform --file $DockerfilePath --tag $LocalTag $ContextPath | Out-Null
    } else {
        Write-Host "Skipping docker build (requested)" -ForegroundColor Yellow
    }

    Write-Host "Tagging $LocalTag as $RemoteTag" -ForegroundColor Cyan
    docker tag $LocalTag $RemoteTag

    if (-not $SkipPush) {
        Write-Host "Logging into Azure Container Registry" -ForegroundColor Cyan
        az acr login --name $AcrName | Out-Null

        Write-Host "Pushing image $RemoteTag" -ForegroundColor Cyan
        docker push $RemoteTag | Out-Null
    } else {
        Write-Host "Skipping docker push (requested)" -ForegroundColor Yellow
    }
}

function Get-OrCreateResourceGroup {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Location
    )

    $rgJson = az group show --name $Name --output json 2>$null
    if ($LASTEXITCODE -eq 0 -and $rgJson) {
        try {
            $rg = $rgJson | ConvertFrom-Json
            return $rg.location
        } catch {
            # fall through to create
        }
    }

    Write-Host "Creating resource group $Name in $Location" -ForegroundColor Cyan
    az group create --name $Name --location $Location | Out-Null
    return $Location
}

$usingExistingPlan = $false
if (-not $appServicePlanProvided) {
    Write-Host "Looking for existing Linux App Service plans in the subscription..." -ForegroundColor Cyan
    $existingPlans = @()
    $planListJson = az appservice plan list --output json 2>$null
    if ($LASTEXITCODE -eq 0 -and $planListJson) {
        try {
            $plansRaw = $planListJson | ConvertFrom-Json
            if ($plansRaw) {
                if ($plansRaw -isnot [System.Collections.IEnumerable]) {
                    $plansRaw = @($plansRaw)
                }
                foreach ($plan in $plansRaw) {
                    if (-not $plan) { continue }

                    $kindString = ""
                    if ($plan.PSObject.Properties.Name -contains "kind" -and $plan.kind) {
                        $kindString = $plan.kind.ToString().ToLowerInvariant()
                    }
                    $reservedFlag = $false
                    if ($plan.PSObject.Properties.Name -contains "reserved" -and $null -ne $plan.reserved) {
                        $reservedFlag = [bool]$plan.reserved
                    }
                    if ($plan.PSObject.Properties.Name -contains "properties" -and $plan.properties -and $plan.properties.PSObject.Properties.Name -contains "reserved") {
                        if ($null -ne $plan.properties.reserved) {
                            $reservedFlag = $reservedFlag -or [bool]$plan.properties.reserved
                        }
                    }

                    $isLinuxPlan = ($kindString -like "*linux*") -or $reservedFlag
                    if (-not $isLinuxPlan) { continue }

                    $skuName = $null
                    $skuTier = $null
                    if ($plan.PSObject.Properties.Name -contains "sku" -and $plan.sku) {
                        if ($plan.sku.PSObject.Properties.Name -contains "name") {
                            $skuName = $plan.sku.name
                        }
                        if ($plan.sku.PSObject.Properties.Name -contains "tier") {
                            $skuTier = $plan.sku.tier
                        }
                    }
                    if (-not $skuName -and $plan.PSObject.Properties.Name -contains "properties" -and $plan.properties -and $plan.properties.PSObject.Properties.Name -contains "sku") {
                        $propSku = $plan.properties.sku
                        if ($propSku) {
                            if ($propSku.PSObject.Properties.Name -contains "name" -and -not $skuName) {
                                $skuName = $propSku.name
                            }
                            if ($propSku.PSObject.Properties.Name -contains "tier" -and -not $skuTier) {
                                $skuTier = $propSku.tier
                            }
                        }
                    }

                    $existingPlans += [PSCustomObject]@{
                        name          = $plan.name
                        resourceGroup = $plan.resourceGroup
                        location      = $plan.location
                        sku           = $skuName
                        tier          = $skuTier
                    }
                }
            }
        } catch {
            $existingPlans = @()
        }
    }

    if ($existingPlans.Count -gt 0) {
        Write-Host "=============" -ForegroundColor Cyan
        Write-Host "[1] Use existing App Service plan below" -ForegroundColor Cyan
        $index = 1
        foreach ($plan in $existingPlans) {
            Write-Host ("    {0}. {1}  (RG: {2}, SKU: {3}, Location: {4})" -f $index, $plan.name, $plan.resourceGroup, ($plan.sku ?? $plan.tier ?? "Unknown"), $plan.location)
            $index++
        }
        Write-Host "[2] Make new App Service plan as '$AppServicePlanName'" -ForegroundColor Cyan
        Write-Host "=============" -ForegroundColor Cyan

        $planChoice = $null
        do {
            $inputPlan = Read-Host "Select option (1-2)"
            if ([int]::TryParse($inputPlan, [ref]$planChoice)) {
                if ($planChoice -ge 1 -and $planChoice -le 2) {
                    break
                }
            }
            Write-Host "Invalid selection. Please enter 1 or 2." -ForegroundColor Yellow
        } while ($true)

        if ($planChoice -eq 1) {
            $planIndex = $null
            do {
                $planInput = Read-Host ("Choose plan number (1-{0})" -f $existingPlans.Count)
                if ([int]::TryParse($planInput, [ref]$planIndex)) {
                    if ($planIndex -ge 1 -and $planIndex -le $existingPlans.Count) {
                        break
                    }
                }
                Write-Host ("Invalid selection. Please enter a number between 1 and {0}." -f $existingPlans.Count) -ForegroundColor Yellow
            } while ($true)

            $selectedPlan = $existingPlans[$planIndex - 1]
            $usingExistingPlan = $true
            $AppServicePlanName = $selectedPlan.name
            if ($WebAppResourceGroupName -ne $selectedPlan.resourceGroup) {
                if ($webAppResourceGroupProvided -and $WebAppResourceGroupName -ne $selectedPlan.resourceGroup) {
                    Write-Host ("Web App resource group overridden to '{0}' to match existing plan '{1}'." -f $selectedPlan.resourceGroup, $selectedPlan.name) -ForegroundColor Yellow
                }
                $WebAppResourceGroupName = $selectedPlan.resourceGroup
            }
            $Location = $selectedPlan.location
        } else {
            Write-Host ("Creating new App Service plan as '{0}'. Provide -AppServicePlanName to override." -f $AppServicePlanName) -ForegroundColor Cyan
        }
    }
}

if (-not $AcrResourceGroupName) {
    $AcrResourceGroupName = $WebAppResourceGroupName
}

if ($usingExistingPlan) {
    Write-Host ("Using existing App Service plan '{0}' in resource group '{1}'." -f $AppServicePlanName, $WebAppResourceGroupName) -ForegroundColor Cyan
}

if (-not $AppInsightsResourceGroupName) {
    $AppInsightsResourceGroupName = $WebAppResourceGroupName
}
if (-not $LogAnalyticsWorkspaceResourceGroupName) {
    $LogAnalyticsWorkspaceResourceGroupName = $WebAppResourceGroupName
}

# Target subscription
Write-Host "Selecting subscription $SubscriptionId" -ForegroundColor Cyan
az account set --subscription $SubscriptionId | Out-Null

# Resource groups
Write-Host "Ensuring Web App resource group $WebAppResourceGroupName" -ForegroundColor Cyan
[void](Get-OrCreateResourceGroup -Name $WebAppResourceGroupName -Location $Location)

if ($AcrResourceGroupName -ne $WebAppResourceGroupName) {
    Write-Host "Ensuring ACR resource group $AcrResourceGroupName" -ForegroundColor Cyan
    [void](Get-OrCreateResourceGroup -Name $AcrResourceGroupName -Location $Location)
}

# ACR details (detect/reuse before creating)
$acr = $null
$acrLookupRg = $AcrResourceGroupName
if (-not $acrLookupRg) {
    $acrLookupRg = $WebAppResourceGroupName
}

if ($PSBoundParameters.ContainsKey('AcrName') -and $AcrName) {
    Write-Host ("Looking for Azure Container Registry '{0}' in resource group '{1}'." -f $AcrName, $acrLookupRg) -ForegroundColor Cyan
    $acr = az acr show --name $AcrName --resource-group $acrLookupRg --output json 2>$null | ConvertFrom-Json
    if (-not $acr) {
        Write-Host "Specified ACR was not found in the target resource group. Will proceed to creation if no other ACR is chosen." -ForegroundColor Yellow
    }
} else {
    Write-Host ("No ACR name provided. Searching ACR in resource group '{0}'." -f $WebAppResourceGroupName) -ForegroundColor Cyan
    $acrList = @()
    $acrListJson = az acr list --resource-group $WebAppResourceGroupName --query "[].{name:name,login:loginServer}" --output json 2>$null
    if ($LASTEXITCODE -eq 0 -and $acrListJson) {
        try {
            $acrList = $acrListJson | ConvertFrom-Json
            if (-not $acrList) {
                $acrList = @()
            } elseif ($acrList -isnot [System.Collections.IEnumerable] -or $acrList -is [string]) {
                $acrList = @($acrList)
            } else {
                $acrList = @($acrList)
            }
        } catch {
            $acrList = @()
        }
    }

    if ($acrList.Count -eq 1) {
        $selected = $acrList[0]
        $AcrName = $selected.name
        $AcrResourceGroupName = $WebAppResourceGroupName
        $acr = az acr show --name $AcrName --resource-group $AcrResourceGroupName --output json 2>$null | ConvertFrom-Json
        Write-Host ("Using existing ACR '{0}' in resource group '{1}'." -f $AcrName, $AcrResourceGroupName) -ForegroundColor Cyan
    } elseif ($acrList.Count -gt 1) {
        Write-Host "=============" -ForegroundColor Cyan
        Write-Host "[1] Use existing Azure Container Registry below" -ForegroundColor Cyan
        $idx = 1
        foreach ($item in $acrList) {
            Write-Host ("    {0}. {1} (login: {2})" -f $idx, $item.name, $item.login)
            $idx++
        }
        Write-Host ("[{0}] Create new ACR" -f $idx) -ForegroundColor Cyan
        Write-Host "=============" -ForegroundColor Cyan

        $choice = $null
        do {
            $inputChoice = Read-Host ("Select option (1-{0})" -f $idx)
            if ([int]::TryParse($inputChoice, [ref]$choice)) {
                if ($choice -ge 1 -and $choice -le $idx) { break }
            }
            Write-Host ("Invalid selection. Please enter a number between 1 and {0}." -f $idx) -ForegroundColor Yellow
        } while ($true)

        if ($choice -lt $idx) {
            $selected = $acrList[$choice - 1]
            $AcrName = $selected.name
            $AcrResourceGroupName = $WebAppResourceGroupName
            $acr = az acr show --name $AcrName --resource-group $AcrResourceGroupName --output json 2>$null | ConvertFrom-Json
            Write-Host ("Using existing ACR '{0}' in resource group '{1}'." -f $AcrName, $AcrResourceGroupName) -ForegroundColor Cyan
        } else {
            Write-Host "User chose to create a new ACR." -ForegroundColor Cyan
        }
    } else {
        Write-Host "No ACR found in the resource group; will create a new one." -ForegroundColor Yellow
    }
}

if (-not $acr) {
    Write-Host ("Creating Azure Container Registry {0} in resource group {1}" -f $AcrName, $AcrResourceGroupName) -ForegroundColor Cyan
    az acr create `
        --name $AcrName `
        --resource-group $AcrResourceGroupName `
        --location $Location `
        --sku $AcrSku `
        --admin-enabled true | Out-Null

    $acr = az acr show --name $AcrName --resource-group $AcrResourceGroupName --output json | ConvertFrom-Json
} else {
    if (-not $AcrResourceGroupName -and $acr.resourceGroup) {
        $AcrResourceGroupName = $acr.resourceGroup
    }
    if (-not $acr.adminUserEnabled) {
        Write-Host "Enabling admin user on ACR $AcrName" -ForegroundColor Cyan
        az acr update --name $AcrName --resource-group $AcrResourceGroupName --admin-enabled true | Out-Null
        $acr = az acr show --name $AcrName --resource-group $AcrResourceGroupName --output json | ConvertFrom-Json
    }
}

$acrLoginServer = $acr.loginServer
$acrCredentials = az acr credential show --name $AcrName --query "{username:username,password:passwords[0].value}" --output json | ConvertFrom-Json
$acrUsername = $acrCredentials.username
$acrPassword = $acrCredentials.password

# Repository existence check to decide tag
$localImageTag = "${ImageName}:local"
$repoExists = $false
$null = az acr repository show --name $AcrName --repository $ImageName --output none 2>$null
if ($LASTEXITCODE -eq 0) {
    $repoExists = $true
}

if ($repoExists) {
    $timestampTag = [DateTime]::UtcNow.AddHours(9).ToString("yyyyMMddHHmm")
    Write-Host ("Repository '{0}' exists in ACR. Using timestamp tag '{1}'." -f $ImageName, $timestampTag) -ForegroundColor Cyan
    $ImageTag = $timestampTag
} else {
    Write-Host ("Repository '{0}' not found in ACR. Using tag '{1}' for initial push." -f $ImageName, $ImageTag) -ForegroundColor Cyan
}

$remoteImageTag = "$acrLoginServer/${ImageName}:${ImageTag}"

Invoke-DockerBuildAndPush -LocalTag $localImageTag -RemoteTag $remoteImageTag -ContextPath $DockerContext -DockerfilePath $Dockerfile -Platform $DockerPlatform -SkipBuild:$SkipDockerBuild -SkipPush:$SkipDockerPush

# App Service plan
Write-Host "Ensuring App Service plan $AppServicePlanName" -ForegroundColor Cyan
az appservice plan show `
    --name $AppServicePlanName `
    --resource-group $WebAppResourceGroupName `
    --output none 2>$null

if ($LASTEXITCODE -ne 0) {
    az appservice plan create `
        --name $AppServicePlanName `
        --resource-group $WebAppResourceGroupName `
        --location $Location `
        --sku $AppServicePlanSku `
        --is-linux | Out-Null
}

$planInfo = $null
$healthSupported = $false
if ($healthCheckRequested) {
    $planInfo = az appservice plan show `
        --name $AppServicePlanName `
        --resource-group $WebAppResourceGroupName `
        --query "{tier:sku.tier,name:sku.name}" `
        --output json 2>$null | ConvertFrom-Json

    if ($LASTEXITCODE -eq 0 -and $planInfo) {
        $planTier = $planInfo.tier
        if ($planTier -and ($planTier -notin @("Free", "Shared"))) {
            $healthSupported = $true
        } else {
            Write-Host "Health check is not available for plan tier '$planTier'. Skipping health check configuration." -ForegroundColor Cyan
        }
    } else {
        Write-Host "Could not retrieve App Service plan details; skipping health check configuration." -ForegroundColor Yellow
    }
}

# Web App
Write-Host "Ensuring Web App $WebAppName" -ForegroundColor Cyan
az webapp show `
    --name $WebAppName `
    --resource-group $WebAppResourceGroupName `
    --output none 2>$null

if ($LASTEXITCODE -ne 0) {
    az webapp create `
        --name $WebAppName `
        --resource-group $WebAppResourceGroupName `
        --plan $AppServicePlanName `
        --container-image-name $remoteImageTag `
        --container-registry-url "https://$acrLoginServer" `
        --container-registry-user $acrUsername `
        --container-registry-password $acrPassword | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Web App '$WebAppName'. Choose a globally unique name or verify the app exists in subscription '$SubscriptionId'."
    }
}

# Container configuration
Write-Host "Configuring container image $remoteImageTag for Web App" -ForegroundColor Cyan
az webapp config container set `
    --name $WebAppName `
    --resource-group $WebAppResourceGroupName `
    --container-image-name $remoteImageTag `
    --container-registry-url "https://$acrLoginServer" `
    --container-registry-user $acrUsername `
    --container-registry-password $acrPassword | Out-Null

# Application settings
$appSettings = @("WEBSITES_PORT=$TargetPort")
if ($EnvironmentVariables -and $EnvironmentVariables.Count -gt 0) {
    $appSettings += $EnvironmentVariables
}

$appInsightsConnectionString = $null
$appInsightsInstrumentationKey = $null
$logAnalyticsWorkspaceId = $null

if ($appInsightsRequested) {
    Write-Host "Application Insights: enabled" -ForegroundColor Cyan
    $appInsightsComponent = $null

    $logAnalyticsWorkspaceId = $null

    if ($UseExistingAppInsights) {
        Write-Host ("Looking for existing Application Insights in subscription '{0}'" -f $SubscriptionId) -ForegroundColor Cyan
        $aiListJson = az resource list `
            --subscription $SubscriptionId `
            --resource-type "microsoft.insights/components" `
            --query "[].{name:name,resourceGroup:resourceGroup,location:location}" `
            --output json 2>$null
        if ($LASTEXITCODE -eq 0 -and $aiListJson) {
            try {
                $aiList = $aiListJson | ConvertFrom-Json
                if ($aiList -and $aiList.Count -gt 0) {
                    Write-Host "=============" -ForegroundColor Cyan
                    Write-Host "[1] Use existing Application Insights below" -ForegroundColor Cyan
                    $i = 1
                    foreach ($ai in $aiList) {
                        Write-Host ("    {0}. {1} (Location: {2}, RG: {3})" -f $i, $ai.name, $ai.location, $ai.resourceGroup)
                        $i++
                    }
                    Write-Host "[2] Create new Application Insights as '$AppInsightsName' in resource group '$AppInsightsResourceGroupName'" -ForegroundColor Cyan
                    Write-Host "=============" -ForegroundColor Cyan

                    $choice = $null
                    do {
                        $inputChoice = Read-Host "Select option (1-2)"
                        if ([int]::TryParse($inputChoice, [ref]$choice)) {
                            if ($choice -ge 1 -and $choice -le 2) { break }
                        }
                        Write-Host "Invalid selection. Please enter 1 or 2." -ForegroundColor Yellow
                    } while ($true)

                    if ($choice -eq 1) {
                        $selectedIndex = $null
                        do {
                            $inputIndex = Read-Host ("Choose App Insights number (1-{0})" -f $aiList.Count)
                            if ([int]::TryParse($inputIndex, [ref]$selectedIndex)) {
                                if ($selectedIndex -ge 1 -and $selectedIndex -le $aiList.Count) { break }
                            }
                            Write-Host ("Invalid selection. Please enter a number between 1 and {0}." -f $aiList.Count) -ForegroundColor Yellow
                        } while ($true)
                        $appInsightsComponent = $aiList[$selectedIndex - 1]
                        $AppInsightsName = $appInsightsComponent.name
                        $AppInsightsResourceGroupName = $appInsightsComponent.resourceGroup
                        Write-Host ("Using existing Application Insights '{0}' in resource group '{1}'." -f $AppInsightsName, $AppInsightsResourceGroupName) -ForegroundColor Cyan
                    } else {
                        Write-Host "Proceeding to create new Application Insights (user selected)." -ForegroundColor Cyan
                    }
                } else {
                    Write-Host "No Application Insights resources found in the subscription. Will create a new one." -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Failed to list Application Insights resources; will attempt to create a new one." -ForegroundColor Yellow
            }
        } else {
            Write-Host "Could not query Application Insights resources; will attempt to create a new one." -ForegroundColor Yellow
        }
    }

    if (-not $appInsightsComponent) {
        Write-Host ("Ensuring Log Analytics workspace resource group '{0}'" -f $LogAnalyticsWorkspaceResourceGroupName) -ForegroundColor Cyan
        [void](Get-OrCreateResourceGroup -Name $LogAnalyticsWorkspaceResourceGroupName -Location $Location)
        $workspace = $null

        if (-not $logAnalyticsWorkspaceProvided) {
            $lawList = @()
            $lawListJson = az monitor log-analytics workspace list `
                --resource-group $LogAnalyticsWorkspaceResourceGroupName `
                --query "[].{name:name,id:id,location:location}" `
                --output json 2>$null

            if ($LASTEXITCODE -eq 0 -and $lawListJson) {
                try {
                    $lawList = $lawListJson | ConvertFrom-Json
                    if (-not $lawList) {
                        $lawList = @()
                    } elseif ($lawList -isnot [System.Collections.IEnumerable]) {
                        $lawList = @($lawList)
                    } else {
                        $lawList = @($lawList)
                    }
                } catch {
                    $lawList = @()
                }
            }

            if ($lawList.Count -eq 1) {
                $selectedLaw = $lawList[0]
                $LogAnalyticsWorkspaceName = $selectedLaw.name
                $logAnalyticsWorkspaceId = $selectedLaw.id
                Write-Host ("Using existing Log Analytics workspace '{0}' in resource group '{1}'." -f $LogAnalyticsWorkspaceName, $LogAnalyticsWorkspaceResourceGroupName) -ForegroundColor Cyan
            } elseif ($lawList.Count -gt 1) {
                Write-Host "=============" -ForegroundColor Cyan
                Write-Host "[1] Use existing Log Analytics workspace below" -ForegroundColor Cyan
                $lawIdx = 1
                foreach ($law in $lawList) {
                    Write-Host ("    {0}. {1} (Location: {2})" -f $lawIdx, $law.name, $law.location)
                    $lawIdx++
                }
                Write-Host ("[{0}] Create new Log Analytics workspace" -f $lawIdx) -ForegroundColor Cyan
                Write-Host "=============" -ForegroundColor Cyan

                $lawChoice = $null
                do {
                    $inputLawChoice = Read-Host ("Select option (1-{0})" -f $lawIdx)
                    if ([int]::TryParse($inputLawChoice, [ref]$lawChoice)) {
                        if ($lawChoice -ge 1 -and $lawChoice -le $lawIdx) { break }
                    }
                    Write-Host ("Invalid selection. Please enter a number between 1 and {0}." -f $lawIdx) -ForegroundColor Yellow
                } while ($true)

                if ($lawChoice -lt $lawIdx) {
                    $selectedLaw = $lawList[$lawChoice - 1]
                    $LogAnalyticsWorkspaceName = $selectedLaw.name
                    $logAnalyticsWorkspaceId = $selectedLaw.id
                    Write-Host ("Using existing Log Analytics workspace '{0}' in resource group '{1}'." -f $LogAnalyticsWorkspaceName, $LogAnalyticsWorkspaceResourceGroupName) -ForegroundColor Cyan
                } else {
                    Write-Host "User chose to create a new Log Analytics workspace." -ForegroundColor Cyan
                }
            } else {
                Write-Host "No Log Analytics workspace found in the resource group; will create a new one." -ForegroundColor Yellow
            }
        }

        if (-not $LogAnalyticsWorkspaceName) {
            $LogAnalyticsWorkspaceName = "$safeName-law"
        }

        if (-not $logAnalyticsWorkspaceId) {
            Write-Host ("Ensuring Log Analytics workspace '{0}' in resource group '{1}'" -f $LogAnalyticsWorkspaceName, $LogAnalyticsWorkspaceResourceGroupName) -ForegroundColor Cyan
            $workspace = az monitor log-analytics workspace show `
                --resource-group $LogAnalyticsWorkspaceResourceGroupName `
                --workspace-name $LogAnalyticsWorkspaceName `
                --output json 2>$null | ConvertFrom-Json

            if (-not $workspace) {
                az monitor log-analytics workspace create `
                    --resource-group $LogAnalyticsWorkspaceResourceGroupName `
                    --workspace-name $LogAnalyticsWorkspaceName `
                    --location $Location `
                    --sku PerGB2018 | Out-Null

                $workspace = az monitor log-analytics workspace show `
                    --resource-group $LogAnalyticsWorkspaceResourceGroupName `
                    --workspace-name $LogAnalyticsWorkspaceName `
                    --output json | ConvertFrom-Json
            }

            if ($workspace -and $workspace.id) {
                $logAnalyticsWorkspaceId = $workspace.id
            } else {
                Write-Host "Could not resolve Log Analytics workspace id; Application Insights creation may fail." -ForegroundColor Yellow
            }
        }

        Write-Host ("Creating Application Insights '{0}' in resource group '{1}'" -f $AppInsightsName, $WebAppResourceGroupName) -ForegroundColor Cyan
        $createParams = @(
            "--app", $AppInsightsName,
            "--location", $Location,
            "--resource-group", $WebAppResourceGroupName,
            "--application-type", "web"
        )
        if ($logAnalyticsWorkspaceId) {
            $createParams += @("--workspace", $logAnalyticsWorkspaceId)
        }

        az monitor app-insights component create @createParams | Out-Null

        $AppInsightsResourceGroupName = $WebAppResourceGroupName
    }

    $aiShowJson = az monitor app-insights component show `
        --app $AppInsightsName `
        --resource-group $AppInsightsResourceGroupName `
        --query "{conn:connectionString,ikey:instrumentationKey}" `
        --output json 2>$null

    if ($LASTEXITCODE -eq 0 -and $aiShowJson) {
        try {
            $aiData = $aiShowJson | ConvertFrom-Json
            $appInsightsConnectionString = $aiData.conn
            $appInsightsInstrumentationKey = $aiData.ikey
            Write-Host ("Application Insights connected (RG: {0}, Name: {1})." -f $AppInsightsResourceGroupName, $AppInsightsName) -ForegroundColor Cyan
        } catch {
            Write-Host "Failed to parse Application Insights details; skipping configuration." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Could not retrieve Application Insights details; skipping configuration." -ForegroundColor Yellow
    }

    if ($DisableIpMasking) {
        if (-not $AppInsightsName -or -not $AppInsightsResourceGroupName) {
            Write-Host "DisableIpMasking requested but Application Insights identifiers are missing; skipping IP masking update." -ForegroundColor Yellow
        } else {
            $updateCommand = Get-Command -Name Update-AzApplicationInsights -ErrorAction SilentlyContinue
            if (-not $updateCommand) {
                throw "DisableIpMasking was requested, but Azure PowerShell cmdlet 'Update-AzApplicationInsights' is not available. Install the Az.ApplicationInsights module (Install-Module -Name Az.ApplicationInsights) and rerun."
            } else {
                try {
                    if (Get-Command -Name Set-AzContext -ErrorAction SilentlyContinue) {
                        Set-AzContext -Subscription $SubscriptionId -ErrorAction Stop | Out-Null
                    }

                    # Uses Azure PowerShell because IP masking toggle is not exposed via Azure CLI.
                    Update-AzApplicationInsights -Name $AppInsightsName -ResourceGroupName $AppInsightsResourceGroupName -DisableIPMasking:$true | Out-Null
                    $verifyMasking = $null
                    try {
                        $verifyMasking = Get-AzApplicationInsights -Name $AppInsightsName -ResourceGroupName $AppInsightsResourceGroupName -ErrorAction Stop
                    } catch {}

                    if ($verifyMasking -and ($verifyMasking.PSObject.Properties.Name -contains "DisableIpMasking")) {
                        $applied = [bool]$verifyMasking.DisableIpMasking
                        Write-Host ("Application Insights IP masking disabled (Azure PowerShell). disableIpMasking={0}" -f $applied) -ForegroundColor Cyan
                    } else {
                        Write-Host "Application Insights IP masking update invoked; could not verify disableIpMasking state (property missing)." -ForegroundColor Cyan
                    }
                } catch {
                    Write-Host ("Failed to disable Application Insights IP masking via Azure PowerShell: {0}" -f $_) -ForegroundColor Yellow
                }
            }
        }
    }
} else {
    Write-Host "Application Insights: disabled" -ForegroundColor Yellow
    if ($DisableIpMasking) {
        Write-Host "DisableIpMasking requested but Application Insights is disabled; skipping IP masking update." -ForegroundColor Yellow
    }
}


Write-Host "Updating application settings" -ForegroundColor Cyan
az webapp config appsettings set `
    --name $WebAppName `
    --resource-group $WebAppResourceGroupName `
    --settings $appSettings | Out-Null

if ($appInsightsConnectionString -or $appInsightsInstrumentationKey) {
    $insightsSettings = @()
    if ($appInsightsConnectionString) {
        $insightsSettings += "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsConnectionString"
    }
    if ($appInsightsInstrumentationKey) {
        $insightsSettings += "APPINSIGHTS_INSTRUMENTATIONKEY=$appInsightsInstrumentationKey"
    }
    $insightsSettings += "ApplicationInsightsAgent_EXTENSION_VERSION=~3"

    Write-Host "Applying Application Insights settings" -ForegroundColor Cyan
    az webapp config appsettings set `
        --name $WebAppName `
        --resource-group $WebAppResourceGroupName `
        --settings $insightsSettings | Out-Null
}

if ($healthSupported -and $HealthCheckPath) {
    Write-Host "Enabling health check path '$HealthCheckPath'" -ForegroundColor Cyan
    az webapp update `
        --name $WebAppName `
        --resource-group $WebAppResourceGroupName `
        --set siteConfig.healthCheckPath=$HealthCheckPath | Out-Null
} elseif ($healthCheckRequested) {
    Write-Host "Health check not enabled (plan not supported)." -ForegroundColor Cyan
}

# Restart to apply container changes
Write-Host "Restarting Web App to pick up changes" -ForegroundColor Cyan
az webapp restart `
    --name $WebAppName `
    --resource-group $WebAppResourceGroupName | Out-Null

$defaultHostName = az webapp show `
    --name $WebAppName `
    --resource-group $WebAppResourceGroupName `
    --query defaultHostName `
    --output tsv

Write-Host "Deployment complete" -ForegroundColor Green
Write-Host "Web App URL: https://$defaultHostName" -ForegroundColor Green
}
finally {
    if ($script:ctrlCHandlerRegistered -and $script:ctrlCHandler) {
        try {
            [System.Console]::remove_CancelKeyPress($script:ctrlCHandler)
        } catch {
            Write-Verbose ("Failed to detach Ctrl+C handler: {0}" -f $_)
        }
    }
}
