import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { closeDatabasePool, getDb } from './connection.js'

async function main(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: './src/database/migrations' })
  console.log('Migrations applied.')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exitCode = 1
  })
  .finally(() => closeDatabasePool())
