import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const notificationSettingColumns = [ 'newPeerTubeVersion', 'newPluginVersion' ]

    for (const column of notificationSettingColumns) {
      const data = {
        type: Sequelize.INTEGER,
        defaultValue: null,
        allowNull: true
      }
      await utils.queryInterface.addColumn('userNotificationSetting', column, data)
    }

    {
      const query = 'UPDATE "userNotificationSetting" SET "newPeerTubeVersion" = 3, "newPluginVersion" = 1'
      await utils.sequelize.query(query)
    }

    for (const column of notificationSettingColumns) {
      const data = {
        type: Sequelize.INTEGER,
        defaultValue: null,
        allowNull: false
      }
      await utils.queryInterface.changeColumn('userNotificationSetting', column, data)
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
