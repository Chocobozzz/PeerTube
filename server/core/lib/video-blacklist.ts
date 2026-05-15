import {
  AutomaticTagPolicy,
  LiveVideoError,
  UserAdminFlag,
  UserRight,
  VideoBlacklistCreate,
  VideoBlacklistType,
  VideoBlacklistType_Type
} from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { englishLanguage, t } from '@server/helpers/i18n.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { getServerAccount } from '@server/models/application/application.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MUser,
  MVideoAccountLight,
  MVideoBlacklist,
  MVideoBlacklistVideo,
  MVideoWithBlacklistLight,
  MVideoWithRights,
  MVideoWithSchedule
} from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { logger, loggerTagsFactory } from '../helpers/logger.js'
import { CONFIG } from '../initializers/config.js'
import { VideoBlacklistModel } from '../models/video/video-blacklist.js'
import { sendDeleteVideo } from './activitypub/send/index.js'
import { federateVideoIfNeeded, isPrivacyForFederation } from './activitypub/videos/index.js'
import { LiveManager } from './live/live-manager.js'
import { Notifier } from './notifier/index.js'
import { Hooks } from './plugins/hooks.js'

const lTags = loggerTagsFactory('blacklist')

export async function autoBlacklistVideoIfNeeded (parameters: {
  video: MVideoWithBlacklistLight
  isRemote: boolean
  isNew: boolean
  isNewFile: boolean
  automaticTagsByAccount: Record<number, string[]>
  user?: MUser
  notify?: boolean
  transaction?: Transaction
}) {
  const { video, user, isRemote, isNew, isNewFile, automaticTagsByAccount, notify = true, transaction } = parameters

  // Already blacklisted
  if (video.VideoBlacklist) return false

  const doAutoBlacklistByInstancePolicy = await Hooks.wrapFun(
    _autoBlacklistByInstancePolicyNeeded,
    { video, user, isRemote, isNew, isNewFile },
    'filter:video.auto-blacklist.result'
  )

  if (doAutoBlacklistByInstancePolicy) {
    await _autoBlacklist({ video, notify, user, transaction, type: VideoBlacklistType.AUTO_BY_INSTANCE_POLICY })

    return true
  }

  if (await _autoBlacklistByAutoTagPolicyNeeded({ video, user, automaticTagsByAccount, transaction })) {
    await _autoBlacklist({ video, notify, user, transaction, type: VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY })

    return true
  }

  return false
}

async function _autoBlacklist (options: {
  video: MVideoWithBlacklistLight
  notify: boolean
  user: MUser
  transaction: Transaction
  type: VideoBlacklistType_Type
}) {
  const { video, notify, user, transaction, type } = options

  const [ videoBlacklist ] = await VideoBlacklistModel.findOrCreate<MVideoBlacklistVideo>({
    where: {
      videoId: video.id
    },
    defaults: {
      videoId: video.id,
      unfederated: true,
      reason: t('The video has been automatically blocked. A moderator review is required.', user?.getLanguage() ?? englishLanguage),

      type
    },
    transaction
  })
  video.VideoBlacklist = videoBlacklist

  videoBlacklist.Video = video

  if (notify) {
    afterCommitIfTransaction(transaction, () => Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklist))
  }

  logger.info('Video %s auto-blacklisted.', video.uuid, lTags(video.uuid))
}

function _autoBlacklistByInstancePolicyNeeded (parameters: {
  video: MVideoWithBlacklistLight
  isRemote: boolean
  isNew: boolean
  isNewFile: boolean
  user?: MUser
}) {
  const { user, isRemote, isNew, isNewFile } = parameters

  if (!CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED || !user) return false
  if (isRemote || (isNew === false && isNewFile === false)) return false

  if (user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) || user.hasAdminFlag(UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST)) return false

  return true
}

async function _autoBlacklistByAutoTagPolicyNeeded (options: {
  video: MVideoWithBlacklistLight
  transaction: Transaction
  automaticTagsByAccount: Record<number, string[]>
  user?: MUser
}) {
  const { user, video, transaction, automaticTagsByAccount } = options

  if (!automaticTagsByAccount || Object.keys(automaticTagsByAccount).length === 0) return false

  if (video.isLocal() && user?.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) return false

  const accountId = (await getServerAccount()).id
  const tags = automaticTagsByAccount[accountId]
  if (!tags || tags.length === 0) return false

  return AccountAutomaticTagPolicyModel.hasPolicyOnTags({
    accountId,
    policy: AutomaticTagPolicy.AUTO_BLACKLIST_VIDEO,
    tags: automaticTagsByAccount[accountId],
    transaction
  })
}

// ---------------------------------------------------------------------------

export async function blacklistVideo (videoInstance: MVideoAccountLight, options: VideoBlacklistCreate) {
  const blacklist: MVideoBlacklistVideo = await VideoBlacklistModel.create({
    videoId: videoInstance.id,
    unfederated: options.unfederate === true,
    reason: options.reason,
    type: VideoBlacklistType.MANUAL
  })
  blacklist.Video = videoInstance

  if (options.unfederate === true && videoInstance.isLocal() && isPrivacyForFederation(videoInstance.privacy)) {
    await sendDeleteVideo({ video: videoInstance, transaction: undefined })
  }

  if (videoInstance.isLive) {
    LiveManager.Instance.stopSessionOfVideo({ videoUUID: videoInstance.uuid, error: LiveVideoError.BLACKLISTED })
  }

  Notifier.Instance.notifyOnVideoBlacklist(blacklist)
}

export async function unblacklistVideo (videoBlacklist: MVideoBlacklist, video: MVideoWithRights) {
  const videoBlacklistType = await sequelizeTypescript.transaction(async t => {
    const unfederated = videoBlacklist.unfederated
    const videoBlacklistType = videoBlacklist.type

    await videoBlacklist.destroy({ transaction: t })
    video.VideoBlacklist = undefined

    // Re federate the video
    if (unfederated === true) {
      await federateVideoIfNeeded(await VideoModel.loadFull(video.id, t), true, t)
    }

    return videoBlacklistType
  })

  Notifier.Instance.notifyOnVideoUnblacklist(video)

  if (videoBlacklistType === VideoBlacklistType.AUTO_BY_INSTANCE_POLICY) {
    const videoWithSchedule = video as MVideoWithRights & MVideoWithSchedule
    videoWithSchedule.ScheduleVideoUpdate = await videoWithSchedule.$get('ScheduleVideoUpdate')

    Notifier.Instance.notifyOnVideoPublishedAfterRemovedFromAutoBlacklist(videoWithSchedule)

    // Delete on object so new video notifications will send
    delete video.VideoBlacklist
    Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoWithSchedule)
  }
}
