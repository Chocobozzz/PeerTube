import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.STRING(400),
    allowNull: false,
    defaultValue: ''
  }

  return q.addColumn('Pods', 'email', data)
    .then(() => {
      const query = 'UPDATE "Pods" SET "email" = \'dummy@example.com\''
      return utils.sequelize.query(query, { transaction: utils.transaction })
    })
    .then(() => {
      data.defaultValue = null

      return q.changeColumn('Pods', 'email', data)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
