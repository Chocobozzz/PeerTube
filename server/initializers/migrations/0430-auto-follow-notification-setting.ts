import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotificationSetting', 'autoInstanceFollowing', data)
  }

  {
    const query = 'UPDATE "userNotificationSetting" SET "autoInstanceFollowing" = 1'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotificationSetting', 'autoInstanceFollowing', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
