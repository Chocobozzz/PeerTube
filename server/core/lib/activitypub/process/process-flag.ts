import { createAccountAbuse, createVideoAbuse, createVideoCommentAbuse } from '@server/lib/moderation.js'
import { AccountModel } from '@server/models/account/account.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { abusePredefinedReasonsMap } from '@peertube/peertube-core-utils'
import { AbuseState, ActivityFlag } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { logger } from '../../../helpers/logger.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { getAPId } from '../../../lib/activitypub/activity.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MAccountDefault, MActorSignature, MCommentOwnerVideo } from '../../../types/models/index.js'

async function processFlagActivity (options: APProcessorOptions<ActivityFlag>) {
  const { activity, byActor } = options

  return retryTransactionWrapper(processCreateAbuse, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processFlagActivity
}

// ---------------------------------------------------------------------------

async function processCreateAbuse (flag: ActivityFlag, byActor: MActorSignature) {
  const account = byActor.Account
  if (!account) throw new Error('Cannot create abuse with the non account actor ' + byActor.url)

  const reporterAccount = await AccountModel.load(account.id)

  const objects = Array.isArray(flag.object) ? flag.object : [ flag.object ]

  const tags = Array.isArray(flag.tag) ? flag.tag : []
  const predefinedReasons = tags.map(tag => abusePredefinedReasonsMap[tag.name])
                                .filter(v => !isNaN(v))

  const startAt = flag.startAt
  const endAt = flag.endAt

  for (const object of objects) {
    try {
      const uri = getAPId(object)

      logger.debug('Reporting remote abuse for object %s.', uri)

      await sequelizeTypescript.transaction(async t => {
        const video = await VideoModel.loadByUrlAndPopulateAccountAndFiles(uri, t)
        let videoComment: MCommentOwnerVideo
        let flaggedAccount: MAccountDefault

        if (!video) videoComment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(uri, t)
        if (!videoComment) flaggedAccount = await AccountModel.loadByUrl(uri, t)

        if (!video && !videoComment && !flaggedAccount) {
          logger.warn('Cannot flag unknown entity %s.', object)
          return
        }

        const baseAbuse = {
          reporterAccountId: reporterAccount.id,
          reason: flag.content,
          state: AbuseState.PENDING,
          predefinedReasons
        }

        if (video) {
          return createVideoAbuse({
            baseAbuse,
            startAt,
            endAt,
            reporterAccount,
            transaction: t,
            videoInstance: video,
            skipNotification: false
          })
        }

        if (videoComment) {
          return createVideoCommentAbuse({
            baseAbuse,
            reporterAccount,
            transaction: t,
            commentInstance: videoComment,
            skipNotification: false
          })
        }

        return await createAccountAbuse({
          baseAbuse,
          reporterAccount,
          transaction: t,
          accountInstance: flaggedAccount,
          skipNotification: false
        })
      })
    } catch (err) {
      logger.debug('Cannot process report of %s', getAPId(object), { err })
    }
  }
}
