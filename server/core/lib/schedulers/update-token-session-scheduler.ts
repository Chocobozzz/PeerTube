import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'
import { isProdInstance } from '@peertube/peertube-node-utils'

const lTags = loggerTagsFactory('schedulers')

type UpdatePayload = {
  lastActivityDate: Date
  lastActivityIP: string
  lastActivityDevice: string
}

export class UpdateTokenSessionScheduler extends AbstractScheduler {
  private static instance: UpdateTokenSessionScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.UPDATE_TOKEN_SESSION

  private toUpdate = new Map<number, UpdatePayload>()

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  addToUpdate (id: number, payload: UpdatePayload) {
    this.toUpdate.set(id, payload)
  }

  protected async internalExecute () {
    // Log only on production instances to reduce noise on development/test instances
    if (isProdInstance()) logger.debug('Running update token session scheduler', lTags())

    const entriesToUpdate = this.toUpdate.entries()
    this.toUpdate = new Map()

    for (const [ id, payload ] of entriesToUpdate) {
      await OAuthTokenModel.update({
        lastActivityDate: payload.lastActivityDate,
        lastActivityIP: payload.lastActivityIP,
        lastActivityDevice: payload.lastActivityDevice
      }, {
        where: { id },
        // Prevent tokens cache invalidation, we don't update fields that are meaningful for this cache
        hooks: false
      })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
