import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('thumbnail', 'aspectRatio', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '16:9'
    }, { transaction })
  }

  {
    await utils.queryInterface.changeColumn('thumbnail', 'aspectRatio', {
      type: Sequelize.STRING,
      allowNull: false,
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
