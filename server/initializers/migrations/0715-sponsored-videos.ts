import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const data = {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
  await utils.queryInterface.addColumn("video", "sponsored", data)
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
