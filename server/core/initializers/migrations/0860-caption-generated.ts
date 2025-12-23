import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.queryInterface.addColumn('videoCaption', 'automaticallyGenerated', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.changeColumn('videoCaption', 'automaticallyGenerated', {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: false
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
