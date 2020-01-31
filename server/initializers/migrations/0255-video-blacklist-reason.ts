import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {

  {
    const data = {
      type: Sequelize.STRING(300),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoBlacklist', 'reason', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
