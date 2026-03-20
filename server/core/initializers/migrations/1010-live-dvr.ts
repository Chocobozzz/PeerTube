import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('videoLive', 'dvrWindow', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction })

    await utils.queryInterface.changeColumn('videoLive', 'dvrWindow', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }, { transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
