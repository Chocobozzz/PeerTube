import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('videoLive', 'scheduledAt', {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
