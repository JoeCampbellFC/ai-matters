// Azure Database for PostgreSQL Flexible Server for AI Matters' Phase 4
// persistence layer. Entra-only authentication (no password auth at all) --
// the app connects using its own App Service system-assigned managed
// identity; a one-time bootstrap step (documented in README, not Bicep --
// Bicep alone can't create a SQL role) grants that identity a scoped,
// non-admin role on the `ai_matters` database.
//
// Networking: public access restricted by firewall rule (Allow Azure
// services) + enforced TLS -- no VNet/private endpoint for v1, matching the
// rest of this app's simple single-App-Service topology.

@description('Name of the PostgreSQL Flexible Server. Must be globally unique across Azure.')
param serverName string

@description('Azure region for the server.')
param location string

@description('Compute SKU -- Burstable B1ms is the cheapest stable tier, appropriate for dev/small production workloads.')
param skuName string = 'Standard_B1ms'

@description('SKU tier matching skuName.')
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'

@description('Storage size in GiB.')
param storageSizeGB int = 32

@description('Backup retention in days.')
param backupRetentionDays int = 7

@description('High availability mode -- disabled by default; set to ZoneRedundant for production.')
@allowed(['Disabled', 'ZoneRedundant', 'SameZone'])
param highAvailabilityMode string = 'Disabled'

@description('PostgreSQL major version.')
param postgresVersion string = '17'

@description('Name of the application database.')
param databaseName string = 'ai_matters'

@description('Entra tenant id (az account show --query tenantId).')
param tenantId string = subscription().tenantId

@description('Object id of the Entra principal to register as the server\'s administrator (used only for the one-time bootstrap step -- never the app\'s own runtime identity).')
param administratorObjectId string

@description('Display name of the administrator principal (user or group name).')
param administratorPrincipalName string

@description('Principal type of the administrator.')
@allowed(['User', 'Group', 'ServicePrincipal'])
param administratorPrincipalType string = 'User'

@description('Tags applied to all resources in this module.')
param tags object = {}

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: highAvailabilityMode
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: tenantId
    }
  }
}

resource administrator 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2025-08-01' = {
  parent: server
  name: administratorObjectId
  properties: {
    principalType: administratorPrincipalType
    principalName: administratorPrincipalName
    tenantId: tenantId
  }
}

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2025-08-01' = {
  parent: server
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
  dependsOn: [administrator]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: server
  name: databaseName
  dependsOn: [administrator]
}

@description('The server\'s fully qualified domain name.')
output serverFqdn string = server.properties.fullyQualifiedDomainName

@description('The server resource name.')
output serverName string = server.name
