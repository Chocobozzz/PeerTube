import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotificationSetting', 'myVideoEditionFinished', data, { transaction })
  }

  {
    const query = 'UPDATE "userNotificationSetting" SET "myVideoEditionFinished" = 1'
    await utils.sequelize.query(query, { transaction })
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotificationSetting', 'myVideoEditionFinished', data, { transaction })
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
