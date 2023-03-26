import { QueryTypes, Sequelize, Transaction } from 'sequelize'

// Sequelize always skip the update if we only update updatedAt field
function setAsUpdated (options: {
  sequelize: Sequelize
  table: string
  id: number
  transaction?: Transaction
}) {
  const { sequelize, table, id, transaction } = options

  return sequelize.query(
    `UPDATE "${table}" SET "updatedAt" = :updatedAt WHERE id = :id`,
    {
      replacements: { table, id, updatedAt: new Date() },
      type: QueryTypes.UPDATE,
      transaction
    }
  )
}

export {
  setAsUpdated
}
