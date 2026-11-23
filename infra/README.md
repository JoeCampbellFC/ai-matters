# AI Matters infrastructure

Two Bicep templates:

- `main.bicep` — the single App Service (API + built frontend) plus, as of Phase 4, an Azure Database for PostgreSQL Flexible Server (`modules/postgres.bicep`).
- `modules/postgres.bicep` — the Postgres server, its `ai_matters` database, a firewall rule allowing Azure services, and an Entra administrator registration.

## Deploying

```bash
az deployment group create \
  --resource-group <your-resource-group> \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.json
```

Copy `main.parameters.example.json` to `main.parameters.json` (git-ignored) and fill in real values. `postgresAdministratorObjectId`/`postgresAdministratorPrincipalName` should be **your own** Entra identity (get your object id with `az ad signed-in-user show --query id -o tsv`) — never the app's own runtime identity. That administrator registration is only ever used for the one-time bootstrap step below, not for normal app traffic.

Run `az bicep build --file infra/main.bicep` / `az bicep lint --file infra/main.bicep` to validate before deploying, and `az deployment group what-if ...` with the same parameters to preview changes — **always do this on an existing resource group**: ARM does not reliably preserve a resource's existing tags across a redeploy unless the template explicitly declares them, so a drive-by redeploy without checking what-if first can silently strip governance tags.

## Postgres: Entra-only auth, no passwords

`authConfig.passwordAuth` is `Disabled` — there is no SQL password for this server at all. The app authenticates to Postgres as its own **App Service system-assigned managed identity** (enabled on the `site` resource), using `@azure/identity`'s `DefaultAzureCredential` to fetch a token for the `https://ossrdbms-aad.database.windows.net/.default` scope (see `server/src/database/connection.ts`). `DATABASE_AUTH_MODE=entra` and `DATABASE_USER=<appName>` are set automatically as app settings by `main.bicep`.

Bicep alone cannot create a SQL role for that identity — Postgres Flexible Server's Entra integration requires a SQL-level call (`pgaadauth_create_principal_with_oid`) run by an Entra administrator. **This is the one bootstrap step that must be run manually, once, after the first deployment**, documented below.

## One-time bootstrap (after the first deployment)

1. Get the app's managed identity object id and the Postgres server FQDN from the deployment outputs (`appManagedIdentityObjectId`, `postgresServerFqdn`) — or re-fetch them any time with:
   ```bash
   az webapp identity show --name <appName> --resource-group <rg> --query principalId -o tsv
   az postgres flexible-server show --name <postgresServerName> --resource-group <rg> --query fullyQualifiedDomainName -o tsv
   ```
2. As the Entra administrator (your own account, logged in via `az login`), get a Postgres-scoped access token and connect with `psql`:
   ```bash
   export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
   psql "host=<postgresServerFqdn> dbname=ai_matters user=<your-upn> sslmode=require"
   ```
3. Create the app's role and map it to the managed identity. **The documented `pgaadauth_create_principal_with_oid()` SQL function was not available on this server** (the `pgaadauth` extension exists but isn't allow-listed for `CREATE EXTENSION`, at least as of this server's current version/region) — the `SECURITY LABEL` mechanism works instead and is what was actually used:
   ```sql
   CREATE ROLE "<appName>" WITH LOGIN;
   SECURITY LABEL FOR pgaadauth ON ROLE "<appName>" IS 'aadauth,oid=<appManagedIdentityObjectId>,type=service';
   ```
   Then grant it **DML only, never CREATE/DROP/ALTER** — schema changes only ever happen via migrations run by the administrator, keeping runtime and migration privileges separate (per the Phase 4 design):
   ```sql
   GRANT CONNECT ON DATABASE ai_matters TO "<appName>";
   GRANT USAGE ON SCHEMA public TO "<appName>";
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "<appName>";
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<appName>";
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "<appName>";
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "<appName>";
   ```
   The `ALTER DEFAULT PRIVILEGES` statements only take effect for objects later created **by the same role that ran them** (the administrator) — so migrations must be run under that same administrator identity (next step), not under the app's own role. Verify afterwards with `\dp <table>` in psql: the app's role should show only `arwd` (select/insert/update/delete), never `D` (truncate) or schema-owner privileges.

4. By default, Postgres Flexible Server's public network access only allows **other Azure services** through its firewall (the `AllowAzureServices` rule) — it does not allow your own machine. To run the bootstrap SQL and migrations from a dev machine, add a firewall rule for your current public IP first:
   ```bash
   az postgres flexible-server firewall-rule create \
     --resource-group <rg> --server-name <postgresServerName> \
     --name AllowAdminBootstrapIP \
     --start-ip-address <your-public-ip> --end-ip-address <your-public-ip>
   ```
   This is deliberately left in place afterwards (not a one-shot/temporary rule) — ongoing admin access for future migrations and maintenance is the intended design, matching the "public access + firewall + admin IP" networking model this deployment uses.

## Running migrations against Azure

Run `drizzle-kit`'s migrator from a dev machine with `az login` active as the Postgres administrator, pointed at the Azure server:

```bash
DATABASE_HOST=<postgresServerFqdn> \
DATABASE_PORT=5432 \
DATABASE_NAME=ai_matters \
DATABASE_USER=<your-upn-or-admin-role-name> \
DATABASE_SSL=true \
DATABASE_AUTH_MODE=entra \
npm --prefix server run db:migrate
```

`DefaultAzureCredential` picks up the local `az login` session automatically (via `AzureCliCredential`) — no extra setup needed. Wiring this into `azure-pipelines.yml` as an automated CI step is a deliberate follow-up (see the Phase 4 plan), not done in the first pass, so the schema is validated locally/manually at least once before a pipeline runs migrations unattended against the live database.

## Local development

No Azure account needed. Install PostgreSQL locally (native install or `docker compose up -d postgres`, using the root `docker-compose.yml`) and point `server/.env` at it with `DATABASE_AUTH_MODE=password`. See `server/.env.example`.
