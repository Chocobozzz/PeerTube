import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const dvrEnabled = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }

  const dvrWindow = {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 7200000
  }

  await utils.queryInterface.addColumn('videoLive', 'dvrEnabled', dvrEnabled, { transaction: utils.transaction })
  await utils.queryInterface.addColumn('videoLive', 'dvrWindow', dvrWindow, { transaction: utils.transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
