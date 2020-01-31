import * as Sequelize from 'sequelize'
import { Migration } from '../../models/migrations'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const data = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  } as Migration.Boolean
  await utils.queryInterface.addColumn('video', 'commentsEnabled', data)

  data.defaultValue = null
  return utils.queryInterface.changeColumn('video', 'commentsEnabled', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
