import { QueryTypes, Transaction } from 'sequelize'
import { sequelizeTypescript } from '@server/initializers/database'

// Sequelize always skip the update if we only update updatedAt field
function setAsUpdated (table: string, id: number, transaction?: Transaction) {
  return sequelizeTypescript.query(
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
