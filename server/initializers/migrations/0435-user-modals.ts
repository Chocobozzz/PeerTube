import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }

    await utils.queryInterface.addColumn('user', 'noInstanceConfigWarningModal', data)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }

    await utils.queryInterface.addColumn('user', 'noWelcomeModal', data)
    data.defaultValue = false

    await utils.queryInterface.changeColumn('user', 'noWelcomeModal', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
