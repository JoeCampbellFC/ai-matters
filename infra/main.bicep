// AI Matters -- single App Service hosting both the Express API and the
// built frontend (served statically by Express -- see server/src/index.ts).
// Deploy once to provision/update infrastructure; azure-pipelines.yml only
// ever deploys code afterwards, never touches these settings again.
//
// Usage (from a local shell with `az login` already done, and the target
// resource group already created via `az group create`):
//
//   az deployment group create \
//     --resource-group <your-resource-group> \
//     --template-file infra/main.bicep \
//     --parameters appName=<globally-unique-name> \
//                  imanageMcpUrl=https://<tenant>.cloudimanage.com/mcp/work \
//                  azureOpenAiEndpoint=https://<resource>.openai.azure.com \
//                  azureOpenAiDeploymentName=gpt-5.4 \
//                  sessionSecret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
//                  azureOpenAiApiKey=<your-azure-openai-key>
//
// Secrets are passed as CLI parameters (never written to a committed file).
// Re-running this deployment is safe/idempotent -- it will update the same
// resources in place.

@description('Name of the App Service. Must be globally unique across Azure -- becomes <appName>.azurewebsites.net.')
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU. F1 (Free) has no Always On and sleeps after ~20min idle; B1 (Basic, ~$13/mo) adds Always On and is more resilient for the OAuth flow.')
param skuName string = 'B1'

// Free/Shared tiers don't support Always On at all -- Azure rejects the deployment if it's set on them.
var supportsAlwaysOn = !(skuName == 'F1' || skuName == 'D1')

@description('Base URL of the iManage MCP Work connector for your tenant, e.g. https://cloudimanage.com/mcp/work')
param imanageMcpUrl string

@secure()
@description('Long random value used to sign the session cookie. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
param sessionSecret string

@description('Azure OpenAI resource endpoint, e.g. https://<resource>.openai.azure.com (no trailing path).')
param azureOpenAiEndpoint string

@secure()
@description('Azure OpenAI API key for the resource above.')
param azureOpenAiApiKey string

@description('Azure OpenAI deployment name used for Phase 2 matter summarisation, e.g. gpt-5.4.')
param azureOpenAiDeploymentName string

@description('Azure OpenAI Decisions API deployment name used for Phase 3 matter classification.')
param azureOpenAiDecisionsDeploymentName string = 'gpt-6-luna'

@description('Identifies which iManage tenant this deployment serves -- see server/src/config.ts tenantId.')
param tenantIdForApp string = 'default-tenant'

@description('Name of the PostgreSQL Flexible Server (Phase 4). Must be globally unique across Azure.')
param postgresServerName string

@description('PostgreSQL compute SKU.')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL SKU tier.')
param postgresSkuTier string = 'Burstable'

@description('Object id of the Entra principal (your own user, typically) to register as the Postgres server administrator -- used only for the one-time bootstrap step, never the app\'s own runtime identity. Get with: az ad signed-in-user show --query id -o tsv')
param postgresAdministratorObjectId string

@description('Display name/UPN of the administrator principal above.')
param postgresAdministratorPrincipalName string

@description('Principal type of the administrator above.')
@allowed(['User', 'Group', 'ServicePrincipal'])
param postgresAdministratorPrincipalType string = 'User'

@description('Tags applied to every resource in this template -- pass the resource group\'s existing governance tags explicitly so a redeploy never silently strips them (ARM does not reliably preserve unlisted tags on every resource type).')
param tags object = {}

var appUrl = 'https://${appName}.azurewebsites.net'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true
  }
}

module postgres 'modules/postgres.bicep' = {
  name: '${appName}-postgres-deployment'
  params: {
    serverName: postgresServerName
    location: location
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    administratorObjectId: postgresAdministratorObjectId
    administratorPrincipalName: postgresAdministratorPrincipalName
    administratorPrincipalType: postgresAdministratorPrincipalType
    tags: tags
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: supportsAlwaysOn
      appCommandLine: 'npm start'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        // The pipeline ships a fully self-contained package (dist/ + node_modules/),
        // so the platform should never try to run its own install/build step.
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'IMANAGE_MCP_URL', value: imanageMcpUrl }
        { name: 'OAUTH_REDIRECT_URL', value: '${appUrl}/api/auth/callback' }
        { name: 'FRONTEND_URL', value: appUrl }
        { name: 'SESSION_SECRET', value: sessionSecret }
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', value: azureOpenAiApiKey }
        { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: azureOpenAiDeploymentName }
        { name: 'AZURE_OPENAI_DECISIONS_DEPLOYMENT_NAME', value: azureOpenAiDecisionsDeploymentName }
        { name: 'TENANT_ID', value: tenantIdForApp }
        // Entra-only auth: the app authenticates to Postgres as its own
        // system-assigned managed identity (DATABASE_USER = this App
        // Service's name, granted a scoped non-admin role via the one-time
        // bootstrap step -- see infra/README.md). No password is ever set.
        { name: 'DATABASE_HOST', value: postgres.outputs.serverFqdn }
        { name: 'DATABASE_PORT', value: '5432' }
        { name: 'DATABASE_NAME', value: 'ai_matters' }
        { name: 'DATABASE_USER', value: appName }
        { name: 'DATABASE_SSL', value: 'true' }
        { name: 'DATABASE_AUTH_MODE', value: 'entra' }
      ]
    }
  }
}

@description('The deployed app\'s URL.')
output appUrl string = appUrl

@description('Register this exact URL as the redirect URI on your iManage OAuth client.')
output oauthRedirectUrl string = '${appUrl}/api/auth/callback'

@description('The App Service\'s system-assigned managed identity object id -- needed for the Postgres bootstrap step (infra/README.md).')
output appManagedIdentityObjectId string = site.identity.principalId

@description('The Postgres server\'s FQDN.')
output postgresServerFqdn string = postgres.outputs.serverFqdn
