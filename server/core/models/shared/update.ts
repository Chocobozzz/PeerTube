import { QueryTypes, Sequelize, Transaction } from 'sequelize'

const updating = new Set<string>()
const tableWhitelist = new Set([ 'runnerJob', 'actorFollow', 'videoPlaylist', 'video', 'videoChannel' ])

// Sequelize always skip the update if we only update updatedAt field
export async function setAsUpdated (options: {
  sequelize: Sequelize
  table: 'runnerJob' | 'actorFollow' | 'videoPlaylist' | 'video' | 'videoChannel'
  id: number
  transaction?: Transaction
}) {
  const { sequelize, table, id, transaction } = options

  if (tableWhitelist.has(table) === false) {
    throw new Error('Invalid table')
  }

  const key = table + '-' + id

  if (updating.has(key)) return
  updating.add(key)

  try {
    await sequelize.query(
      `UPDATE "${table}" SET "updatedAt" = :updatedAt WHERE id = :id`,
      {
        replacements: { id, updatedAt: new Date() },
        type: QueryTypes.UPDATE,
        transaction
      }
    )
  } finally {
    updating.delete(key)
  }
}

export async function bumpUpdatedAt (options: {
  sequelize: Sequelize
  table: 'videoPlaylist' | 'video'
  id: number
  transaction: Transaction
}) {
  const { sequelize, table, id, transaction } = options

  if (tableWhitelist.has(table) === false) {
    throw new Error('Invalid table')
  }

  // We must not prevent concurrent updates, we need the real datetime of the last update. The query already handle concurrent updates
  // Dates are federated with a millisecond precision
  // Not a SELECT query type, so it is never sent to a database read replica
  const [ result ] = await sequelize.query(
    `UPDATE "${table}" SET "updatedAt" = GREATEST(:now, date_trunc('milliseconds', "updatedAt") + INTERVAL '1 millisecond') ` +
      `WHERE id = :id RETURNING "updatedAt"`,
    {
      replacements: { id, now: new Date() },
      type: QueryTypes.RAW,
      transaction
    }
  )
  const rows = result as { updatedAt: Date }[]

  // Deleted in the meantime
  if (rows.length === 0) return new Date()

  return rows[0].updatedAt
}
