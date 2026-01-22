import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const metadata = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }

  await utils.queryInterface.addColumn('videoLive', 'dvrEnabled', metadata, { transaction: utils.transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
