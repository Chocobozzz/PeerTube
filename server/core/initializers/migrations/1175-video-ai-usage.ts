import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('video', 'aiUsage', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1 // NOT_SPECIFIED
  }, { transaction })

  await utils.queryInterface.addColumn('user', 'aiUsagesHidden', {
    type: Sequelize.ARRAY(Sequelize.INTEGER),
    allowNull: false,
    defaultValue: []
  }, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
