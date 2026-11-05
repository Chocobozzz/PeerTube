import {
  AutomaticTagPolicy,
  LiveVideoError,
  UserAdminFlag,
  UserRight,
  VideoBlacklistCreate,
  VideoBlacklistType,
  VideoBlacklistType_Type
} from '@peertube/peertube-models'
import { afterCommitIfTransaction, runTransaction } from '@server/helpers/database-utils.js'
import { englishLanguage, t } from '@server/helpers/i18n.js'
import { getServerAccount } from '@server/models/application/application.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
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
import { createLogger } from '../helpers/logger.js'
import { CONFIG } from '../initializers/config.js'
import { VideoBlacklistModel } from '../models/video/video-blacklist.js'
import { sendDeleteVideo } from './activitypub/send/index.js'
import { isPrivacyForFederation, scheduleVideoFederation } from './activitypub/videos/index.js'
import { LiveManager } from './live/live-manager.js'
import { Notifier } from './notifier/index.js'
import { Hooks } from './plugins/hooks.js'

const logger = createLogger('blacklist')

export type AutoBlacklistStatus = 'auto-blacklisted' | 'held-for-auto-tags' | 'not-auto-blacklisted'

export async function autoBlacklistVideoIfNeeded (parameters: {
  video: MVideoWithBlacklistLight
  isRemote: boolean
  isNew: boolean
  isNewFile: boolean

  // The automatic tags of the video have not been built yet: we don't know which tags it will have
  holdIfAutoTagPolicy: boolean
  automaticTagsByAccount?: Record<number, string[]>

  user?: MUser
  notify?: boolean
  transaction?: Transaction
}): Promise<AutoBlacklistStatus> {
  const { video, user, isRemote, isNew, isNewFile, holdIfAutoTagPolicy, automaticTagsByAccount, notify = true, transaction } = parameters

  // Already blacklisted
  if (video.VideoBlacklist) return 'auto-blacklisted'

  const doAutoBlacklistByInstancePolicy = await Hooks.wrapFun(
    _autoBlacklistByInstancePolicyNeeded,
    { video, user, isRemote, isNew, isNewFile },
    'filter:video.auto-blacklist.result'
  )

  // Global instance policy
  if (doAutoBlacklistByInstancePolicy) {
    await _autoBlacklist({ video, notify, user, transaction, type: VideoBlacklistType.AUTO_BY_INSTANCE_POLICY })

    return 'auto-blacklisted'
  }

  // Special hold mode if the instance has auto tag policies that could block the video,
  // and the automatic tags of the video have not been built: block the video if the instance could want to review it
  // Let the `build-object-automatic-tags` job release it if the tags it ends up with don't match any of its auto block policies
  if (holdIfAutoTagPolicy && await _shouldHoldForAutoTagPolicy({ video, user, transaction })) {
    await _autoBlacklist({
      video,
      notify: false, // Don't notify, build auto tag job will notify if the video is really blocked
      user,
      transaction,
      type: VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY
    })

    return 'held-for-auto-tags'
  }

  // Not in hold mode: auto blacklist the video if its automatic tags match an auto block policy
  if (await _shouldAutoBlacklistByAutoTagPolicy({ video, user, automaticTagsByAccount, transaction })) {
    await _autoBlacklist({
      video,
      notify,
      user,
      transaction,
      type: VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY
    })

    return 'auto-blacklisted'
  }

  return 'not-auto-blacklisted'
}

// Called by the `build-object-automatic-tags` job for a video that was not put on hold
// Apply the auto tag block policies using the tags the job has just built
export async function autoBlacklistVideoByAutoTagPolicyIfNeeded (options: {
  video: MVideoWithRights
  automaticTagsByAccount: Record<number, string[]>
  user?: MUser
  notify?: boolean
  transaction?: Transaction
}) {
  const { video, automaticTagsByAccount, user, notify = true, transaction } = options

  if (video.VideoBlacklist) return false
  if (!await _shouldAutoBlacklistByAutoTagPolicy({ video, user, automaticTagsByAccount, transaction })) return false

  await _autoBlacklist({
    video,
    notify,
    user,
    transaction,
    type: VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY
  })

  logger.info('Video %s auto-blocked by its automatic tags.', video.uuid)

  return true
}

// Called by the `build-object-automatic-tags` job for a video that has been auto blocked while waiting for its tags
// Confirm the block and notify the moderators, or remove it
export async function resolvePendingAutoTagBlacklist (options: {
  video: MVideoWithRights
  automaticTagsByAccount: Record<number, string[]>
  transaction?: Transaction
}) {
  const { video, automaticTagsByAccount, transaction } = options

  const videoBlacklist = await VideoBlacklistModel.loadByVideoId(video.id, transaction)
  if (!videoBlacklist || videoBlacklist.type !== VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY) return

  if (await _shouldAutoBlacklistByAutoTagPolicy({ video, automaticTagsByAccount, transaction })) {
    const videoBlacklistWithVideo = videoBlacklist as MVideoBlacklistVideo
    videoBlacklistWithVideo.Video = video

    afterCommitIfTransaction(transaction, () => Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklistWithVideo))

    logger.info('Video %s auto-blocking confirmed by its automatic tags.', video.uuid)
    return
  }

  await _removeBlacklist(videoBlacklist, video, transaction)
  await _releasePendingAutoTagHold(video, transaction)

  logger.info('Removed auto-blocking of video %s: its automatic tags do not match any auto block policy.', video.uuid)
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

  logger.info('Video %s auto-blacklisted.', video.uuid)
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

async function _shouldHoldForAutoTagPolicy (options: {
  video: MVideoWithBlacklistLight
  transaction?: Transaction
  user?: MUser
}) {
  const { user, video, transaction } = options

  if (video.isLocal() && user?.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) return false

  const accountId = (await getServerAccount()).id

  return AccountAutomaticTagPolicyModel.hasPolicy({
    accountId,
    policy: AutomaticTagPolicy.AUTO_BLACKLIST_VIDEO,
    transaction
  })
}

async function _shouldAutoBlacklistByAutoTagPolicy (options: {
  video: MVideoWithBlacklistLight
  automaticTagsByAccount?: Record<number, string[]>
  transaction?: Transaction
  user?: MUser
}) {
  const { user, video, transaction, automaticTagsByAccount } = options

  if (!automaticTagsByAccount) return false

  if (video.isLocal() && user?.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) return false

  const accountId = (await getServerAccount()).id

  const tags = automaticTagsByAccount?.[accountId]
  if (!tags || tags.length === 0) return false

  return AccountAutomaticTagPolicyModel.hasPolicyOnTags({
    accountId,
    policy: AutomaticTagPolicy.AUTO_BLACKLIST_VIDEO,
    tags,
    transaction
  })
}

// ---------------------------------------------------------------------------

export async function blacklistVideo (videoInstance: MVideoAccountLight, options: VideoBlacklistCreate) {
  const blacklist: MVideoBlacklistVideo = await VideoBlacklistModel.create({
    videoId: videoInstance.id,
    unfederated: options.unfederate === true,
    reason: options.reason,
    internalNote: options.internalNote,
    type: VideoBlacklistType.MANUAL
  })
  blacklist.Video = videoInstance

  if (options.unfederate === true && videoInstance.isLocal() && isPrivacyForFederation(videoInstance.privacy)) {
    await sendDeleteVideo({ video: videoInstance, transaction: undefined })
  }

  if (videoInstance.isLive) {
    LiveManager.Instance.stopSessionOfVideo({ videoUUID: videoInstance.uuid, error: LiveVideoError.BLACKLISTED })
      .catch(err => logger.error('Cannot stop session of video %s.', videoInstance.uuid, { err }))
  }

  Notifier.Instance.notifyOnVideoBlacklist(blacklist)

  return blacklist
}

export async function unblacklistVideo (videoBlacklist: MVideoBlacklist, video: MVideoWithRights) {
  const videoBlacklistType = await _removeBlacklist(videoBlacklist, video)

  Notifier.Instance.notifyOnVideoUnblacklist(video)

  if (videoBlacklistType === VideoBlacklistType.AUTO_BY_INSTANCE_POLICY) {
    await _notifyVideoReleasedFromAutoBlacklist(video)
  }
}

function _removeBlacklist (videoBlacklist: MVideoBlacklist, video: MVideoWithRights, transaction?: Transaction) {
  const run = async (t: Transaction) => {
    const unfederated = videoBlacklist.unfederated
    const videoBlacklistType = videoBlacklist.type

    await videoBlacklist.destroy({ transaction: t })
    video.VideoBlacklist = undefined

    // Re federate the video
    if (unfederated === true) {
      scheduleVideoFederation({ video, transaction: t })
    }

    return videoBlacklistType
  }

  if (transaction) return run(transaction)

  return runTransaction(run)
}

async function _notifyVideoReleasedFromAutoBlacklist (video: MVideoWithRights, transaction?: Transaction) {
  const videoWithSchedule = video as MVideoWithRights & MVideoWithSchedule
  videoWithSchedule.ScheduleVideoUpdate = await videoWithSchedule.$get('ScheduleVideoUpdate', { transaction })

  // Delete on object so new video notifications will send
  delete video.VideoBlacklist

  afterCommitIfTransaction(transaction, () => {
    Notifier.Instance.notifyOnVideoPublishedAfterRemovedFromAutoBlacklist(videoWithSchedule)
    Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoWithSchedule)
  })
}

// Same as _notifyVideoReleasedFromAutoBlacklist but do not send "removed from auto blacklist" notification
async function _releasePendingAutoTagHold (video: MVideoWithRights, transaction?: Transaction) {
  const videoWithSchedule = video as MVideoWithRights & MVideoWithSchedule
  videoWithSchedule.ScheduleVideoUpdate = await videoWithSchedule.$get('ScheduleVideoUpdate', { transaction })

  // Delete on object so new video notifications will send
  delete video.VideoBlacklist

  afterCommitIfTransaction(transaction, () => {
    Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoWithSchedule)
  })
}
