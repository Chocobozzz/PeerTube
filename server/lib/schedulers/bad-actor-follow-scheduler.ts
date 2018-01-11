import { logger } from '../../helpers/logger'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { AbstractScheduler } from './abstract-scheduler'

export class BadActorFollowScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  private constructor () {
    super()
  }

  async execute () {
    try {
      await ActorFollowModel.removeBadActorFollows()
    } catch (err) {
      logger.error('Error in bad actor follows scheduler.', err)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
