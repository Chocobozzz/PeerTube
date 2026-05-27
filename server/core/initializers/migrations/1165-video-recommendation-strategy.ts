import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('video', 'recommendationStrategy', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1 // ANY_VIDEOS
  }, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
