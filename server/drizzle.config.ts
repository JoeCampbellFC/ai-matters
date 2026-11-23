import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'ai_matters',
    user: process.env.DATABASE_USER ?? 'ai_matters_dev',
    password: process.env.DATABASE_PASSWORD ?? '',
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true',
  },
})
