import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

type UpdatePayload = {
  id: number
  lastActivityDate: Date
  lastActivityIP: string
  lastActivityDevice: string
}

export class UpdateTokenSessionScheduler extends AbstractScheduler {
  private static instance: UpdateTokenSessionScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.UPDATE_TOKEN_SESSION

  private readonly toUpdate = new Set<UpdatePayload>()

  private constructor () {
    super()
  }

  addToUpdate (payload: UpdatePayload) {
    this.toUpdate.add(payload)
  }

  protected async internalExecute () {
    const toUpdate = Array.from(this.toUpdate)
    this.toUpdate.clear()

    for (const payload of toUpdate) {
      await OAuthTokenModel.update({
        lastActivityDate: payload.lastActivityDate,
        lastActivityIP: payload.lastActivityIP,
        lastActivityDevice: payload.lastActivityDevice
      }, {
        where: {
          id: payload.id
        },
        // Prevent tokens cache invalidation, we don't update fields that are meaningful for this cache
        hooks: false
      })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
