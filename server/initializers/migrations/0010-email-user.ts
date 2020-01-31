import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { Migration } from '../../models/migrations'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.STRING(400),
    allowNull: false,
    defaultValue: ''
  } as Migration.String
  return q.addColumn('Users', 'email', data)
    .then(() => {
      const query = 'UPDATE "Users" SET "email" = CONCAT("username", \'@example.com\')'
      return utils.sequelize.query(query, { transaction: utils.transaction })
    })
    .then(() => {
      data.defaultValue = null

      return q.changeColumn('Users', 'email', data)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
