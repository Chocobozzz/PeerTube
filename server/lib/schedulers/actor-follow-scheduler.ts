import { isTestInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers'
import { ActorFollowScoreCache } from '../cache'

export class ActorFollowScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.actorFollowScores

  private constructor () {
    super()
  }

  protected async internalExecute () {
    await this.processPendingScores()

    await this.removeBadActorFollows()
  }

  private async processPendingScores () {
    const pendingScores = ActorFollowScoreCache.Instance.getPendingFollowsScoreCopy()

    ActorFollowScoreCache.Instance.clearPendingFollowsScore()

    for (const inbox of Object.keys(pendingScores)) {
      await ActorFollowModel.updateFollowScore(inbox, pendingScores[inbox])
    }
  }

  private async removeBadActorFollows () {
    if (!isTestInstance()) logger.info('Removing bad actor follows (scheduler).')

    try {
      await ActorFollowModel.removeBadActorFollows()
    } catch (err) {
      logger.error('Error in bad actor follows scheduler.', { err })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
