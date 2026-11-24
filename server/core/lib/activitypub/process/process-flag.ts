import { abusePredefinedReasonsMap, arrayify, uniqify } from '@peertube/peertube-core-utils'
import { AbuseState, ActivityFlag } from '@peertube/peertube-models'
import { peertubeTruncate } from '@peertube/peertube-node-utils'
import { isAbuseReasonValid } from '@server/helpers/custom-validators/abuses.js'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS, REMOTE_ABUSE_DEFAULT_REASON, REMOTE_ABUSES } from '@server/initializers/constants.js'
import { createAccountAbuse, createVideoAbuse, createVideoCommentAbuse } from '@server/lib/moderation.js'
import { Redis } from '@server/lib/redis/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { retryTransactionWrapper, runTransaction } from '../../../helpers/database-utils.js'
import { createLogger } from '../../../helpers/logger.js'
import { getAPId } from '../../../lib/activitypub/activity.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MAccountDefault, MActorSignature, MCommentOwnerVideo } from '../../../types/models/index.js'

const logger = createLogger()

async function processFlagActivity (options: APProcessorOptions<ActivityFlag>) {
  const { activity, byActor } = options

  return retryTransactionWrapper(() => processCreateAbuse(activity, byActor))
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

  // Each object creates an abuse and notifies moderators
  const objectUrls = uniqify(arrayify(flag.object).map(o => getAPId(o)))
  if (objectUrls.length > ACTIVITY_PUB.MAX_FLAG_OBJECTS) {
    logger.info(`Flag ${flag.id} has more than ${ACTIVITY_PUB.MAX_FLAG_OBJECTS} objects, only processing the first ones`)
  }

  const tags = Array.isArray(flag.tag) ? flag.tag : []
  // Stored in an array column: keep each predefined reason once
  const predefinedReasons = uniqify(
    tags.map(tag => tag?.name)
      .filter(name => typeof name === 'string' && Object.hasOwn(abusePredefinedReasonsMap, name))
      .map(name => abusePredefinedReasonsMap[name])
  )

  const reason = getFlagReason(flag)

  const startAt = flag.startAt
  const endAt = flag.endAt

  for (const uri of objectUrls.slice(0, ACTIVITY_PUB.MAX_FLAG_OBJECTS)) {
    let limitReached = false

    try {
      logger.debug('Reporting remote abuse for object %s.', uri)

      await runTransaction(async t => {
        const video = await VideoModel.loadByUrlAndPopulateAccountAndFiles(uri, t)
        let videoComment: MCommentOwnerVideo
        let flaggedAccount: MAccountDefault

        if (!video) videoComment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(uri, t)
        if (!video && !videoComment) flaggedAccount = await AccountModel.loadByUrl(uri, t)
        // We don't have channel abuses: report the account owning the channel
        if (!video && !videoComment && !flaggedAccount) {
          flaggedAccount = (await VideoChannelModel.loadByUrlAndPopulateAccount(uri, t))?.Account
        }

        if (!video && !videoComment && !flaggedAccount) {
          logger.warn('Cannot flag unknown entity %s.', uri)
          return
        }

        if (await isAbuseLimitOfHostReached(byActor)) {
          logger.warn(`Too many abuses sent by the host of ${byActor.url}, ignoring flag ${flag.id} of ${uri} and its next objects.`)

          limitReached = true
          return
        }

        const baseAbuse = {
          reporterAccountId: reporterAccount.id,
          reason,
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
      logger.debug('Cannot process report of %s', uri, { err })
    }

    if (limitReached) break
  }
}

// Each abuse notifies moderators: limit how many an instance can send us
async function isAbuseLimitOfHostReached (byActor: MActorSignature) {
  const host = new URL(byActor.url).host.toLowerCase()

  const total = await Redis.Instance.incrementRemoteAbusesOfHost(host)

  return total > REMOTE_ABUSES.MAX_PER_HOST
}

function getFlagReason (flag: ActivityFlag) {
  const reason = [ flag.content, flag.summary ]
    .filter(r => typeof r === 'string')
    .map(r => peertubeTruncate(r.trim(), { length: CONSTRAINTS_FIELDS.ABUSES.REASON.max }))
    .find(r => isAbuseReasonValid(r))

  return reason ?? REMOTE_ABUSE_DEFAULT_REASON
}
