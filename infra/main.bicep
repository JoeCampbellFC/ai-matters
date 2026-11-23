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

@description('App Service Plan SKU. B1 is the cheapest Linux tier that supports Always On and HTTPS-only.')
param skuName string = 'B1'

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

var appUrl = 'https://${appName}.azurewebsites.net'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true
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
      ]
    }
  }
}

@description('The deployed app\'s URL.')
output appUrl string = appUrl

@description('Register this exact URL as the redirect URI on your iManage OAuth client.')
output oauthRedirectUrl string = '${appUrl}/api/auth/callback'
