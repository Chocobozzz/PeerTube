import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.queryInterface.addColumn('user', 'browseVideosCategories', {
    type: Sequelize.ARRAY(Sequelize.INTEGER),
    allowNull: true,
    defaultValue: null
  }, { transaction })

  await utils.queryInterface.addColumn('user', 'browseVideosLive', {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'both'
  }, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
