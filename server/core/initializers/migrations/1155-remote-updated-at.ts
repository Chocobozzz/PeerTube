import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  for (const table of [ 'video', 'videoPlaylist' ]) {
    await utils.queryInterface.addColumn(table, 'remoteUpdatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
