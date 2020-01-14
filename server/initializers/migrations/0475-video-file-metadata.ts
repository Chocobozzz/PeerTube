import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  const data = {
    type: Sequelize.JSON,
    allowNull: true
  }
  await utils.queryInterface.addColumn('videoFile', 'metadata', data)

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
