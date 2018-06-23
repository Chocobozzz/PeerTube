import { isTestInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers'

export class BadActorFollowScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.badActorFollow

  private constructor () {
    super()
  }

  async execute () {
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
