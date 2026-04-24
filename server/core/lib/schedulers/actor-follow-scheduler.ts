import { isProdInstance, isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { sendFollow } from '@server/lib/activitypub/send/send-follow.js'
import { setAsUpdated } from '@server/models/shared/update.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { ACTOR_FOLLOW_SCORE, SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { ActorFollowModel } from '../../models/actor/actor-follow.js'
import { ActorFollowHealthCache } from '../actor-follow-health-cache.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers')

const FOLLOW_RESEND_STALE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const FOLLOW_RESEND_BATCH_SIZE = 100

export class ActorFollowScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.ACTOR_FOLLOW_SCORES

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    // Run too often in test/dev instances
    if (isProdInstance()) {
      logger.info('Processing actor follows scheduler.', lTags())
    }

    await this.processPendingScores()

    await this.removeBadActorFollows()

    await this.resendStaleActorFollows()
  }

  private async processPendingScores () {
    const goodInboxes = ActorFollowHealthCache.Instance.getGoodInboxes()
    const badInboxes = ActorFollowHealthCache.Instance.getBadInboxes()
    const badServerIds = ActorFollowHealthCache.Instance.getBadFollowingServerIds()
    const goodServerIds = ActorFollowHealthCache.Instance.getGoodFollowingServerIds()

    ActorFollowHealthCache.Instance.clearGoodInboxes()
    ActorFollowHealthCache.Instance.clearBadInboxes()
    ActorFollowHealthCache.Instance.clearBadFollowingServerIds()
    ActorFollowHealthCache.Instance.clearGoodFollowingServerIds()

    for (const goodInbox of goodInboxes) {
      if (badInboxes.has(goodInbox)) continue

      await ActorFollowModel.updateScore(goodInbox, ACTOR_FOLLOW_SCORE.BONUS)
    }

    for (const badInbox of badInboxes) {
      if (goodInboxes.has(badInbox)) continue

      await ActorFollowModel.updateScore(badInbox, ACTOR_FOLLOW_SCORE.PENALTY)
    }

    await ActorFollowModel.updateScoreByFollowingServers(Array.from(badServerIds), ACTOR_FOLLOW_SCORE.PENALTY)
    await ActorFollowModel.updateScoreByFollowingServers(Array.from(goodServerIds), ACTOR_FOLLOW_SCORE.BONUS)
  }

  private async removeBadActorFollows () {
    if (!isTestOrDevInstance()) logger.info('Removing bad actor follows (scheduler).', lTags())

    try {
      await ActorFollowModel.removeBadActorFollows()
    } catch (err) {
      logger.error('Error in bad actor follows scheduler.', { err, ...lTags() })
    }
  }

  private async resendStaleActorFollows () {
    const olderThan = new Date(Date.now() - FOLLOW_RESEND_STALE_MS)

    try {
      const actorFollows = await ActorFollowModel.listOutgoingStaleForResend({
        olderThan,
        limit: FOLLOW_RESEND_BATCH_SIZE
      })

      if (actorFollows.length === 0) return

      for (const actorFollow of actorFollows) {
        sendFollow(actorFollow, undefined)

        await setAsUpdated({ sequelize: ActorFollowModel.sequelize, table: 'actorFollow', id: actorFollow.id })
      }

      if (!isTestOrDevInstance()) {
        logger.info('Queued %d stale actor follows for resend.', actorFollows.length, lTags())
      }
    } catch (err) {
      logger.error('Error in stale actor follow resend scheduler.', { err, ...lTags() })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
