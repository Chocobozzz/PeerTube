import { doJSONRequest } from '@server/helpers/requests.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { getServerActor } from '@server/models/application/application.js'
import chunk from 'lodash-es/chunk.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SCHEDULER_INTERVALS_MS, SERVER_ACTOR_NAME } from '../../initializers/constants.js'
import { AbstractScheduler } from './abstract-scheduler.js'

export class AutoFollowIndexInstances extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.AUTO_FOLLOW_INDEX_INSTANCES

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

      const searchParams = { count: 1000 }
      if (this.lastCheck) Object.assign(searchParams, { since: this.lastCheck.toISOString() })

      this.lastCheck = new Date()

      const { body } = await doJSONRequest<any>(indexUrl, { searchParams, preventSSRF: false })
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

          JobQueue.Instance.createJobAsync({ type: 'activitypub-follow', payload })
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
