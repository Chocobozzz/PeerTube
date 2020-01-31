import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }

    await utils.queryInterface.addColumn('videoBlacklist', 'unfederated', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
