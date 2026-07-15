import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('user', 'pluginAuthExternalId', {
    type: Sequelize.STRING(255),
    allowNull: true,
    defaultValue: null
  }, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
