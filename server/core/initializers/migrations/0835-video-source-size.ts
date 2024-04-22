import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.changeColumn('videoSource', 'size', {
      type: Sequelize.BIGINT,
      allowNull: true
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
