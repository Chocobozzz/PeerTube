import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('application', 'latestPeerTubeVersion', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
