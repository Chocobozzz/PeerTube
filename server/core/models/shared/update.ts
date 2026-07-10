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
