import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!connectionString) {
  console.error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED for Neon migrations) before running migrate.')
  process.exit(1)
}

const files = ['neon-schema.sql', 'auth-schema.sql']

async function migrate() {
  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    for (const file of files) {
      const sql = readFileSync(path.join(process.cwd(), 'db', file), 'utf8')
      await client.query(sql)
      console.log(`Applied db/${file}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
