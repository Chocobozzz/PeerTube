import * as sequelize from 'sequelize'
import { CONFIG } from '../initializers/constants'
import { VideoBlacklistType, UserRight } from '../../shared/models'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import { UserModel } from '../models/account/user'
import { VideoModel } from '../models/video/video'
import { logger } from '../helpers/logger'

async function autoBlacklistVideoIfNeeded (video: VideoModel, user: UserModel, transaction: sequelize.Transaction) {
  if (!CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED) return false

  if (user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) return false

  const sequelizeOptions = { transaction }
  const videoBlacklistToCreate = {
    videoId: video.id,
    unfederated: true,
    reason: 'Auto-blacklisted. Moderator review required.',
    type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED
  }
  await VideoBlacklistModel.create(videoBlacklistToCreate, sequelizeOptions)
  logger.info('Video %s auto-blacklisted.', video.uuid)

  return true
}

// ---------------------------------------------------------------------------

export {
  autoBlacklistVideoIfNeeded
}
