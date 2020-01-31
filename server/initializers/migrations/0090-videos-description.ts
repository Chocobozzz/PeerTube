import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.STRING(3000),
    allowNull: false
  }
  await q.changeColumn('Videos', 'description', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
