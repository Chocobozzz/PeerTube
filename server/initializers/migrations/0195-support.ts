import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const data = {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoChannel', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(250),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('account', 'description', data)
  }

  {
    const data = {
      type: Sequelize.STRING(10000),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('video', 'description', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
