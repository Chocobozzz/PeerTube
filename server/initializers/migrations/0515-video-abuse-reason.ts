import * as Sequelize from 'sequelize'
import { VideoAbusePredefinedReasons } from '../../../shared/models/videos'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.bulkInsert('abuseReason', [
    { predefinedReasonId: VideoAbusePredefinedReasons.VIOLENT_OR_REPULSIVE },
    { predefinedReasonId: VideoAbusePredefinedReasons.HATEFUL_OR_ABUSIVE },
    { predefinedReasonId: VideoAbusePredefinedReasons.SPAM_OR_MISLEADING },
    { predefinedReasonId: VideoAbusePredefinedReasons.PRIVACY },
    { predefinedReasonId: VideoAbusePredefinedReasons.RIGHTS },
    { predefinedReasonId: VideoAbusePredefinedReasons.SERVER_RULES },
    { predefinedReasonId: VideoAbusePredefinedReasons.THUMBNAILS },
    { predefinedReasonId: VideoAbusePredefinedReasons.CAPTIONS }
  ])
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
