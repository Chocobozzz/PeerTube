import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    }

    await utils.queryInterface.addColumn('video', 'quarantined', data)
  }

  {
    const query = 'UPDATE "video" SET "quarantined" = false'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('video', 'quarantined', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotificationSetting', 'videoQuarantineAsModerator', data)
  }

  {
    const query = 'UPDATE "userNotificationSetting" SET "videoQuarantineAsModerator" = 3'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotificationSetting', 'videoQuarantineAsModerator', data)
  }
}
function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
