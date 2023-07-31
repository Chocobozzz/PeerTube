import { QueryTypes, Sequelize, Transaction } from 'sequelize'

const updating = new Set<string>()

// Sequelize always skip the update if we only update updatedAt field
async function setAsUpdated (options: {
  sequelize: Sequelize
  table: string
  id: number
  transaction?: Transaction
}) {
  const { sequelize, table, id, transaction } = options
  const key = table + '-' + id

  if (updating.has(key)) return
  updating.add(key)

  try {
    await sequelize.query(
      `UPDATE "${table}" SET "updatedAt" = :updatedAt WHERE id = :id`,
      {
        replacements: { table, id, updatedAt: new Date() },
        type: QueryTypes.UPDATE,
        transaction
      }
    )
  } finally {
    updating.delete(key)
  }
}

export {
  setAsUpdated
}
