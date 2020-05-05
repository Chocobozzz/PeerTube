import { ActivityCreate, ActivityFlag, VideoAbuseState } from '../../../../shared'
import { VideoAbuseObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'
import { APProcessorOptions } from '../../../typings/activitypub-processor.model'
import { MActorSignature, MVideoAbuseAccountVideo } from '../../../typings/models'
import { AccountModel } from '@server/models/account/account'

async function processFlagActivity (options: APProcessorOptions<ActivityCreate | ActivityFlag>) {
  const { activity, byActor } = options
  return retryTransactionWrapper(processCreateVideoAbuse, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processFlagActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideoAbuse (activity: ActivityCreate | ActivityFlag, byActor: MActorSignature) {
  const flag = activity.type === 'Flag' ? activity : (activity.object as VideoAbuseObject)

  const account = byActor.Account
  if (!account) throw new Error('Cannot create video abuse with the non account actor ' + byActor.url)

  const objects = Array.isArray(flag.object) ? flag.object : [ flag.object ]

  for (const object of objects) {
    try {
      logger.debug('Reporting remote abuse for video %s.', getAPId(object))

      const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: object })
      const reporterAccount = await sequelizeTypescript.transaction(async t => AccountModel.load(account.id, t))

      const videoAbuseInstance = await sequelizeTypescript.transaction(async t => {
        const videoAbuseData = {
          reporterAccountId: account.id,
          reason: flag.content,
          videoId: video.id,
          state: VideoAbuseState.PENDING
        }

        const videoAbuseInstance: MVideoAbuseAccountVideo = await VideoAbuseModel.create(videoAbuseData, { transaction: t })
        videoAbuseInstance.Video = video
        videoAbuseInstance.Account = reporterAccount

        logger.info('Remote abuse for video uuid %s created', flag.object)

        return videoAbuseInstance
      })

      const videoAbuseJSON = videoAbuseInstance.toFormattedJSON()

      Notifier.Instance.notifyOnNewVideoAbuse({
        videoAbuse: videoAbuseJSON,
        videoAbuseInstance,
        reporter: reporterAccount.Actor.getIdentifier()
      })
    } catch (err) {
      logger.debug('Cannot process report of %s. (Maybe not a video abuse).', getAPId(object), { err })
    }
  }
}
