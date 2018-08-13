import * as Sequelize from 'sequelize'
import { CONSTRAINTS_FIELDS } from '../constants'
import { VideoAbuseState } from '../../../shared/models/videos'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_BLACKLIST.REASON.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoBlacklist', 'reason', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
