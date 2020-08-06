import { createAccountAbuse, createVideoAbuse, createVideoCommentAbuse } from '@server/lib/moderation'
import { AccountModel } from '@server/models/account/account'
import { VideoModel } from '@server/models/video/video'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { abusePredefinedReasonsMap } from '@shared/core-utils/abuse'
import { AbuseObject, AbuseState, ActivityCreate, ActivityFlag } from '../../../../shared'
import { getAPId } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MAccountDefault, MActorSignature, MCommentOwnerVideo } from '../../../types/models'

async function processFlagActivity (options: APProcessorOptions<ActivityCreate | ActivityFlag>) {
  const { activity, byActor } = options

  return retryTransactionWrapper(processCreateAbuse, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processFlagActivity
}

// ---------------------------------------------------------------------------

async function processCreateAbuse (activity: ActivityCreate | ActivityFlag, byActor: MActorSignature) {
  const flag = activity.type === 'Flag' ? activity : (activity.object as AbuseObject)

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

        const video = await VideoModel.loadByUrlAndPopulateAccount(uri)
        let videoComment: MCommentOwnerVideo
        let flaggedAccount: MAccountDefault

        if (!video) videoComment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideo(uri)
        if (!videoComment) flaggedAccount = await AccountModel.loadByUrl(uri)

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
            videoInstance: video
          })
        }

        if (videoComment) {
          return createVideoCommentAbuse({
            baseAbuse,
            reporterAccount,
            transaction: t,
            commentInstance: videoComment
          })
        }

        return await createAccountAbuse({
          baseAbuse,
          reporterAccount,
          transaction: t,
          accountInstance: flaggedAccount
        })
      })
    } catch (err) {
      logger.debug('Cannot process report of %s', getAPId(object), { err })
    }
  }
}
