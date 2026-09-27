import { sql } from 'drizzle-orm'
import { execute, jsonValue } from './client'

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

function ident(name: string) {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Rejected SQL identifier: ${name}`)
  }
  return sql.identifier(name)
}

export async function updateColumns(
  table: string,
  patch: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  jsonColumns: ReadonlySet<string>,
  where: Array<{ column: string; value: string }>,
  touchUpdatedAt = true
): Promise<number> {
  const entries = Object.entries(patch).filter(([key, value]) => allowed.has(key) && value !== undefined)
  if (entries.length === 0 || where.length === 0) return 0

  const assignments = entries.map(([key, value]) =>
    jsonColumns.has(key) ? sql`${ident(key)} = ${jsonValue(value)}` : sql`${ident(key)} = ${value}`
  )
  if (touchUpdatedAt) {
    assignments.push(sql`${ident('updated_at')} = now()`)
  }

  const conditions = where.map((item) => sql`${ident(item.column)} = ${item.value}`)
  const result = await execute(sql`
    UPDATE ${ident(table)}
    SET ${sql.join(assignments, sql`, `)}
    WHERE ${sql.join(conditions, sql` AND `)}
  `)
  return result.rowCount ?? 0
}
