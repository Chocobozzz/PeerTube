import { chunk } from 'lodash'
import { doRequest } from '@server/helpers/requests'
import { JobQueue } from '@server/lib/job-queue'
import { ActorFollowModel } from '@server/models/activitypub/actor-follow'
import { getServerActor } from '@server/models/application/application'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { SCHEDULER_INTERVALS_MS, SERVER_ACTOR_NAME } from '../../initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

export class AutoFollowIndexInstances extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.autoFollowIndexInstances

  private lastCheck: Date

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return this.autoFollow()
  }

  private async autoFollow () {
    if (CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_INDEX.ENABLED === false) return

    const indexUrl = CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_INDEX.INDEX_URL

    logger.info('Auto follow instances of index %s.', indexUrl)

    try {
      const serverActor = await getServerActor()

      const qs = { count: 1000 }
      if (this.lastCheck) Object.assign(qs, { since: this.lastCheck.toISOString() })

      this.lastCheck = new Date()

      const { body } = await doRequest<any>({ uri: indexUrl, qs, json: true })
      if (!body.data || Array.isArray(body.data) === false) {
        logger.error('Cannot auto follow instances of index %s. Please check the auto follow URL.', indexUrl, { body })
        return
      }

      const hosts: string[] = body.data.map(o => o.host)
      const chunks = chunk(hosts, 20)

      for (const chunk of chunks) {
        const unfollowedHosts = await ActorFollowModel.keepUnfollowedInstance(chunk)

        for (const unfollowedHost of unfollowedHosts) {
          const payload = {
            host: unfollowedHost,
            name: SERVER_ACTOR_NAME,
            followerActorId: serverActor.id,
            isAutoFollow: true
          }

          JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
        }
      }

    } catch (err) {
      logger.error('Cannot auto follow hosts of index %s.', indexUrl, { err })
    }

  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
