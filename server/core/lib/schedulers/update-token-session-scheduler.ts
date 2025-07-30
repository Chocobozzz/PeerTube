import { MOAuthToken } from '@server/types/models/index.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

export class UpdateTokenSessionScheduler extends AbstractScheduler {
  private static instance: UpdateTokenSessionScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.UPDATE_TOKEN_SESSION

  private readonly toUpdate = new Set<MOAuthToken>()

  private constructor () {
    super()
  }

  addToUpdate (token: MOAuthToken) {
    this.toUpdate.add(token)
  }

  protected async internalExecute () {
    const toUpdate = Array.from(this.toUpdate)
    this.toUpdate.clear()

    for (const token of toUpdate) {
      await token.save()
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
