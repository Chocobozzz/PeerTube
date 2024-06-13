import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // Notification
  {
    await utils.queryInterface.addColumn('userNotification', 'videoCaptionId', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'videoCaption',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }, { transaction })
  }

  // Notification settings
  {
    {
      const data = {
        type: Sequelize.INTEGER,
        defaultValue: null,
        allowNull: true
      }
      await utils.queryInterface.addColumn('userNotificationSetting', 'myVideoTranscriptionGenerated', data, { transaction })
    }

    {
      const query = 'UPDATE "userNotificationSetting" SET "myVideoTranscriptionGenerated" = 1'
      await utils.sequelize.query(query, { transaction })
    }

    {
      const data = {
        type: Sequelize.INTEGER,
        defaultValue: null,
        allowNull: false
      }
      await utils.queryInterface.changeColumn('userNotificationSetting', 'myVideoTranscriptionGenerated', data, { transaction })
    }
  }

  // Video job info
  {
    await utils.queryInterface.addColumn('videoJobInfo', 'pendingTranscription', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
