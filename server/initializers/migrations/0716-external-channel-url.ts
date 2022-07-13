import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.queryInterface.createTable('videoChannelSync', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    externalChannelUrl: {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.EXTERNAL_CHANNEL_URL.max),
      allowNull: false
    },
    videoChannel: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'videoChannel',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false
    },
    state: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, { transaction: utils.transaction })
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
  await utils.queryInterface.dropTable('videoChannelSync', { transaction: utils.transaction })
}

export {
  up,
  down
}
