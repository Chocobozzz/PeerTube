import { ActivityDelete } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { logger } from '../../../helpers/logger.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import { VideoPlaylistModel } from '../../../models/video/video-playlist.js'
import { VideoModel } from '../../../models/video/video.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import {
  MAccountActor,
  MActor,
  MActorFull,
  MActorSignature,
  MChannelAccountActor,
  MChannelActor,
  MCommentOwnerVideo
} from '../../../types/models/index.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'

async function processDeleteActivity (options: APProcessorOptions<ActivityDelete>) {
  const { activity, byActor } = options

  const objectUrl = typeof activity.object === 'string' ? activity.object : activity.object.id

  if (activity.actor === objectUrl) {
    // We need more attributes (all the account and channel)
    const byActorFull = await ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url)

    if (byActorFull.type === 'Person') {
      if (!byActorFull.Account) throw new Error('Actor ' + byActorFull.url + ' is a person but we cannot find it in database.')

      const accountToDelete = byActorFull.Account as MAccountActor
      accountToDelete.Actor = byActorFull

      return retryTransactionWrapper(processDeleteAccount, accountToDelete)
    } else if (byActorFull.type === 'Group') {
      if (!byActorFull.VideoChannel) throw new Error('Actor ' + byActorFull.url + ' is a group but we cannot find it in database.')

      const channelToDelete = byActorFull.VideoChannel as MChannelAccountActor & { Actor: MActorFull }
      channelToDelete.Actor = byActorFull
      return retryTransactionWrapper(processDeleteVideoChannel, channelToDelete)
    }
  }

  {
    const videoCommentInstance = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(objectUrl)
    if (videoCommentInstance) {
      return retryTransactionWrapper(processDeleteVideoComment, byActor, videoCommentInstance, activity)
    }
  }

  {
    const videoInstance = await VideoModel.loadByUrlAndPopulateAccountAndFiles(objectUrl)
    if (videoInstance) {
      if (videoInstance.isOwned()) throw new Error(`Remote instance cannot delete owned video ${videoInstance.url}.`)

      return retryTransactionWrapper(processDeleteVideo, byActor, videoInstance)
    }
  }

  {
    const videoPlaylist = await VideoPlaylistModel.loadByUrlAndPopulateAccount(objectUrl)
    if (videoPlaylist) {
      if (videoPlaylist.isOwned()) throw new Error(`Remote instance cannot delete owned playlist ${videoPlaylist.url}.`)

      return retryTransactionWrapper(processDeleteVideoPlaylist, byActor, videoPlaylist)
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processDeleteActivity
}

// ---------------------------------------------------------------------------

async function processDeleteVideo (actor: MActor, videoToDelete: VideoModel) {
  logger.debug('Removing remote video "%s".', videoToDelete.uuid)

  await sequelizeTypescript.transaction(async t => {
    if (videoToDelete.VideoChannel.Account.Actor.id !== actor.id) {
      throw new Error('Account ' + actor.url + ' does not own video channel ' + videoToDelete.VideoChannel.Actor.url)
    }

    await videoToDelete.destroy({ transaction: t })
  })

  logger.info('Remote video with uuid %s removed.', videoToDelete.uuid)
}

async function processDeleteVideoPlaylist (actor: MActor, playlistToDelete: VideoPlaylistModel) {
  logger.debug('Removing remote video playlist "%s".', playlistToDelete.uuid)

  await sequelizeTypescript.transaction(async t => {
    if (playlistToDelete.OwnerAccount.Actor.id !== actor.id) {
      throw new Error('Account ' + actor.url + ' does not own video playlist ' + playlistToDelete.url)
    }

    await playlistToDelete.destroy({ transaction: t })
  })

  logger.info('Remote video playlist with uuid %s removed.', playlistToDelete.uuid)
}

async function processDeleteAccount (accountToRemove: MAccountActor) {
  logger.debug('Removing remote account "%s".', accountToRemove.Actor.url)

  await sequelizeTypescript.transaction(async t => {
    await accountToRemove.destroy({ transaction: t })
  })

  logger.info('Remote account %s removed.', accountToRemove.Actor.url)
}

async function processDeleteVideoChannel (videoChannelToRemove: MChannelActor) {
  logger.debug('Removing remote video channel "%s".', videoChannelToRemove.Actor.url)

  await sequelizeTypescript.transaction(async t => {
    await videoChannelToRemove.destroy({ transaction: t })
  })

  logger.info('Remote video channel %s removed.', videoChannelToRemove.Actor.url)
}

function processDeleteVideoComment (byActor: MActorSignature, videoComment: MCommentOwnerVideo, activity: ActivityDelete) {
  // Already deleted
  if (videoComment.isDeleted()) return Promise.resolve()

  logger.debug('Removing remote video comment "%s".', videoComment.url)

  return sequelizeTypescript.transaction(async t => {
    if (byActor.Account.id !== videoComment.Account.id && byActor.Account.id !== videoComment.Video.VideoChannel.accountId) {
      throw new Error(`Account ${byActor.url} does not own video comment ${videoComment.url} or video ${videoComment.Video.url}`)
    }

    videoComment.markAsDeleted()

    await videoComment.save({ transaction: t })

    if (videoComment.Video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]
      await forwardVideoRelatedActivity(activity, t, exceptions, videoComment.Video)
    }

    logger.info('Remote video comment %s removed.', videoComment.url)
  })
}
