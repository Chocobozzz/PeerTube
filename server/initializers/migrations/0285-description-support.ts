import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.STRING(1000),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('video', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(1000),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoChannel', 'support', data)
  }

  {
    const data = {
      type: Sequelize.STRING(1000),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoChannel', 'description', data)
  }

  {
    const data = {
      type: Sequelize.STRING(1000),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('account', 'description', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
