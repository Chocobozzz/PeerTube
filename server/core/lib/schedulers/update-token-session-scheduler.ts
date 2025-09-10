import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

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
    super()
  }

  addToUpdate (id: number, payload: UpdatePayload) {
    this.toUpdate.set(id, payload)
  }

  protected async internalExecute () {
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
