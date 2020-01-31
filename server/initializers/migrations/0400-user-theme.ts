import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const data = {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'instance-default'
  }

  await utils.queryInterface.addColumn('user', 'theme', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
