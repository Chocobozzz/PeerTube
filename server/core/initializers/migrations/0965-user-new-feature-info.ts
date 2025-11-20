import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.addColumn('user', 'newFeaturesInfoRead', {
    type: Sequelize.INTEGER,
    allowNull: true
  }, { transaction: utils.transaction })

  await utils.sequelize.query('UPDATE "user" SET "newFeaturesInfoRead" = 0', { transaction: utils.transaction })

  await utils.queryInterface.changeColumn('user', 'newFeaturesInfoRead', {
    type: Sequelize.INTEGER,
    allowNull: false
  }, { transaction: utils.transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
