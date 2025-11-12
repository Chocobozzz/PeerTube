import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    await utils.queryInterface.addColumn('videoImport', 'attempts', {
      type: Sequelize.DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction: utils.transaction })
  }

  {
    await utils.queryInterface.addColumn('videoImport', 'payload', {
      type: Sequelize.DataTypes.JSONB,
      allowNull: true
    }, { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
