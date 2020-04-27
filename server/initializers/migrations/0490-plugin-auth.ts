import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const password = {
      type: Sequelize.STRING,
      allowNull: true
    }
    await utils.queryInterface.changeColumn('user', 'password', password)
  }

  {
    const pluginAuth = {
      type: Sequelize.STRING,
      allowNull: true
    }
    await utils.queryInterface.addColumn('user', 'pluginAuth', pluginAuth)
  }

  {
    const authName = {
      type: Sequelize.STRING,
      allowNull: true
    }
    await utils.queryInterface.addColumn('oAuthToken', 'authName', authName)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
