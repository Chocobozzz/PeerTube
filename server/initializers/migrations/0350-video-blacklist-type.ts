import * as Sequelize from 'sequelize'
import { VideoBlacklistType } from '../../../shared/models/videos'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }

    await utils.queryInterface.addColumn('videoBlacklist', 'type', data)
  }

  {
    const query = 'UPDATE "videoBlacklist" SET "type" = ' + VideoBlacklistType.MANUAL
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoBlacklist', 'type', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true
    }
    await utils.queryInterface.addColumn('userNotificationSetting', 'videoAutoBlacklistAsModerator', data)
  }

  {
    const query = 'UPDATE "userNotificationSetting" SET "videoAutoBlacklistAsModerator" = 3'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }
    await utils.queryInterface.changeColumn('userNotificationSetting', 'videoAutoBlacklistAsModerator', data)
  }
}
function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
