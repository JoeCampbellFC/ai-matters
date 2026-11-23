import { DefaultAzureCredential } from '@azure/identity'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../config.js'
import * as schema from './schema/index.js'

/** Azure Database for PostgreSQL's fixed token scope for Entra-authenticated connections. */
const POSTGRES_ENTRA_SCOPE = 'https://ossrdbms-aad.database.windows.net/.default'

let pool: Pool | undefined
let credential: DefaultAzureCredential | undefined

/**
 * In 'entra' mode the pool never holds a static password -- pg calls this
 * function fresh for every new physical connection it opens, so a token
 * acquired near the start of a long-lived process is still re-fetched (and
 * silently refreshed by DefaultAzureCredential's own cache) rather than
 * expiring under a long-running pool.
 */
async function resolvePassword(): Promise<string> {
  if (config.databaseAuthMode === 'password') {
    return config.databasePassword ?? ''
  }
  credential ??= new DefaultAzureCredential()
  const token = await credential.getToken(POSTGRES_ENTRA_SCOPE)
  if (!token) {
    throw new Error('Failed to acquire an Entra token for PostgreSQL authentication.')
  }
  return token.token
}

function getPool(): Pool {
  if (pool) return pool
  pool = new Pool({
    host: config.databaseHost,
    port: config.databasePort,
    database: config.databaseName,
    user: config.databaseUser,
    password: resolvePassword,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
    max: 10,
  })
  return pool
}

/** Lazily-created singleton Drizzle instance -- mirrors mcp/connection.ts's cache-on-first-use style. */
export function getDb() {
  return drizzle(getPool(), { schema })
}

/**
 * Accepted by every repository write function so multi-step operations can
 * share one transaction -- pass a `tx` from db.transaction(...), or omit to
 * run standalone against the pool. Deliberately typed as the base
 * NodePgDatabase (not `ReturnType<typeof getDb>`, which also carries
 * `$client: Pool`) -- a transaction handle is a PgTransaction, which has
 * every query-building method this app uses but not `$client`.
 */
export type Db = NodePgDatabase<typeof schema>

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}

export async function verifyDatabaseConnectivity(): Promise<void> {
  await getPool().query('select 1')
}
