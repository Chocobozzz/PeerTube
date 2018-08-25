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
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoAbuse', 'state', data)
  }

  {
    const query = 'UPDATE "videoAbuse" SET "state" = ' + VideoAbuseState.PENDING
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoAbuse', 'state', data)
  }

  {
    const data = {
      type: Sequelize.STRING(CONSTRAINTS_FIELDS.VIDEO_ABUSES.MODERATION_COMMENT.max),
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoAbuse', 'moderationComment', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
