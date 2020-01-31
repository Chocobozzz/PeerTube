import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const data = {
    type: Sequelize.STRING(400),
    allowNull: true,
    defaultValue: null
  }

  await utils.queryInterface.addColumn('user', 'pendingEmail', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
