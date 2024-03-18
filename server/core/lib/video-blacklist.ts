import { Transaction } from 'sequelize'
import { LiveVideoError, UserAdminFlag, UserRight, VideoBlacklistCreate, VideoBlacklistType } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import {
  MUser,
  MVideoAccountLight,
  MVideoBlacklist,
  MVideoBlacklistVideo,
  MVideoFullLight,
  MVideoWithBlacklistLight
} from '@server/types/models/index.js'
import { logger, loggerTagsFactory } from '../helpers/logger.js'
import { CONFIG } from '../initializers/config.js'
import { VideoBlacklistModel } from '../models/video/video-blacklist.js'
import { sendDeleteVideo } from './activitypub/send/index.js'
import { federateVideoIfNeeded } from './activitypub/videos/index.js'
import { LiveManager } from './live/live-manager.js'
import { Notifier } from './notifier/index.js'
import { Hooks } from './plugins/hooks.js'

const lTags = loggerTagsFactory('blacklist')

async function autoBlacklistVideoIfNeeded (parameters: {
  video: MVideoWithBlacklistLight
  user?: MUser
  isRemote: boolean
  isNew: boolean
  isNewFile: boolean
  notify?: boolean
  transaction?: Transaction
}) {
  const { video, user, isRemote, isNew, isNewFile, notify = true, transaction } = parameters
  const doAutoBlacklist = await Hooks.wrapFun(
    autoBlacklistNeeded,
    { video, user, isRemote, isNew, isNewFile },
    'filter:video.auto-blacklist.result'
  )

  if (!doAutoBlacklist) return false

  const videoBlacklistToCreate = {
    videoId: video.id,
    unfederated: true,
    reason: 'Auto-blacklisted. Moderator review required.',
    type: VideoBlacklistType.AUTO_BEFORE_PUBLISHED
  }
  const [ videoBlacklist ] = await VideoBlacklistModel.findOrCreate<MVideoBlacklistVideo>({
    where: {
      videoId: video.id
    },
    defaults: videoBlacklistToCreate,
    transaction
  })
  video.VideoBlacklist = videoBlacklist

  videoBlacklist.Video = video

  if (notify) {
    afterCommitIfTransaction(transaction, () => {
      Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklist)
    })
  }

  logger.info('Video %s auto-blacklisted.', video.uuid, lTags(video.uuid))

  return true
}

async function blacklistVideo (videoInstance: MVideoAccountLight, options: VideoBlacklistCreate) {
  const blacklist: MVideoBlacklistVideo = await VideoBlacklistModel.create({
    videoId: videoInstance.id,
    unfederated: options.unfederate === true,
    reason: options.reason,
    type: VideoBlacklistType.MANUAL
  })
  blacklist.Video = videoInstance

  if (options.unfederate === true) {
    await sendDeleteVideo(videoInstance, undefined)
  }

  if (videoInstance.isLive) {
    LiveManager.Instance.stopSessionOfVideo({ videoUUID: videoInstance.uuid, error: LiveVideoError.BLACKLISTED })
  }

  Notifier.Instance.notifyOnVideoBlacklist(blacklist)
}

async function unblacklistVideo (videoBlacklist: MVideoBlacklist, video: MVideoFullLight) {
  const videoBlacklistType = await sequelizeTypescript.transaction(async t => {
    const unfederated = videoBlacklist.unfederated
    const videoBlacklistType = videoBlacklist.type

    await videoBlacklist.destroy({ transaction: t })
    video.VideoBlacklist = undefined

    // Re federate the video
    if (unfederated === true) {
      await federateVideoIfNeeded(video, true, t)
    }

    return videoBlacklistType
  })

  Notifier.Instance.notifyOnVideoUnblacklist(video)

  if (videoBlacklistType === VideoBlacklistType.AUTO_BEFORE_PUBLISHED) {
    Notifier.Instance.notifyOnVideoPublishedAfterRemovedFromAutoBlacklist(video)

    // Delete on object so new video notifications will send
    delete video.VideoBlacklist
    Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(video)
  }
}

// ---------------------------------------------------------------------------

export {
  autoBlacklistVideoIfNeeded,
  blacklistVideo,
  unblacklistVideo
}

// ---------------------------------------------------------------------------

function autoBlacklistNeeded (parameters: {
  video: MVideoWithBlacklistLight
  isRemote: boolean
  isNew: boolean
  isNewFile: boolean
  user?: MUser
}) {
  const { user, video, isRemote, isNew, isNewFile } = parameters

  // Already blacklisted
  if (video.VideoBlacklist) return false
  if (!CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED || !user) return false
  if (isRemote || (isNew === false && isNewFile === false)) return false

  if (user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) || user.hasAdminFlag(UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST)) return false

  return true
}
