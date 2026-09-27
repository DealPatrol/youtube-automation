import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { sql, type SQL } from 'drizzle-orm'
import { Pool, type QueryResult, type QueryResultRow } from 'pg'

let pool: Pool | undefined
let database: NodePgDatabase | undefined

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!pool) {
    pool = new Pool({ connectionString, max: 5 })
  }
  return pool
}

export function getDb(): NodePgDatabase {
  if (!database) {
    database = drizzle(getPool())
  }
  return database
}

export async function execute<T extends QueryResultRow = QueryResultRow>(query: SQL): Promise<QueryResult<T>> {
  const result = await getDb().execute(query)
  return result as QueryResult<T>
}

export async function rows<T extends QueryResultRow>(query: SQL): Promise<T[]> {
  const result = await execute<T>(query)
  return result.rows
}

export async function docs<T>(query: SQL): Promise<T[]> {
  const result = await rows<{ doc: T }>(query)
  return result.map((row) => row.doc)
}

export function jsonValue(value: unknown): SQL {
  return sql`${JSON.stringify(value ?? null)}::jsonb`
}
