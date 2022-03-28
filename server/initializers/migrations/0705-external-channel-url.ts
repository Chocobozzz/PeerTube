import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.queryInterface.addColumn('videoChannel', 'externalChannelUrl', {
    type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.EXTERNAL_CHANNEL_URL.max),
    defaultValue: null,
    allowNull: true
  }, { transaction: utils.transaction })
}

async function down (utils: {
  queryInterface: Sequelize.QueryInterface
  transaction: Sequelize.Transaction
}) {
  await utils.queryInterface.removeColumn('videoChannel', 'externalChannelUrl', { transaction: utils.transaction })
}

export {
  up,
  down
}
