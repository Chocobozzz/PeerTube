import { createLogger } from '../helpers/logger.js'
import { ActorFollowHealthKind } from './redis/actor-follow-health.js'
import { Redis } from './redis/index.js'

const logger = createLogger()

// Cache follows scores, instead of writing them too often in database
// Kept in Redis because every process sends activities, but only the primary applies the scores
export class ActorFollowHealthCache {
  private static instance: ActorFollowHealthCache

  private constructor () {}

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async updateActorFollowsHealth (goodInboxes: string[], badInboxes: string[]) {
    try {
      await Redis.Instance.setLastBadInboxes(badInboxes)

      if (goodInboxes.length === 0 && badInboxes.length === 0) return

      logger.info(
        'Updating %d good actor follows and %d bad actor follows.',
        goodInboxes.length,
        badInboxes.length,
        { badInboxes }
      )

      await Promise.all([
        Redis.Instance.addActorFollowHealth('good-inboxes', goodInboxes),
        Redis.Instance.addActorFollowHealth('bad-inboxes', badInboxes)
      ])
    } catch (err) {
      logger.error('Cannot update actor follows health.', { err })
    }
  }

  // Returns a boolean for each inbox URL
  async areLastBadInboxes (inboxUrls: string[]) {
    try {
      return await Redis.Instance.areLastBadInboxes(inboxUrls)
    } catch (err) {
      logger.error('Cannot check if inboxes are last bad inboxes.', { err })

      return inboxUrls.map(() => false)
    }
  }

  // ---------------------------------------------------------------------------

  addBadServerId (serverId: number) {
    return this.addServerId('bad-server-ids', serverId)
  }

  addGoodServerId (serverId: number) {
    return this.addServerId('good-server-ids', serverId)
  }

  // ---------------------------------------------------------------------------

  // Returns the pending health data and removes it
  async popPendingHealth () {
    const [ goodInboxes, badInboxes, goodServerIds, badServerIds ] = await Promise.all([
      Redis.Instance.popActorFollowHealth('good-inboxes'),
      Redis.Instance.popActorFollowHealth('bad-inboxes'),
      Redis.Instance.popActorFollowHealth('good-server-ids'),
      Redis.Instance.popActorFollowHealth('bad-server-ids')
    ])

    return {
      goodInboxes: new Set(goodInboxes),
      badInboxes: new Set(badInboxes),
      goodServerIds: new Set(goodServerIds.map(id => parseInt(id, 10))),
      badServerIds: new Set(badServerIds.map(id => parseInt(id, 10)))
    }
  }

  // ---------------------------------------------------------------------------

  private async addServerId (kind: ActorFollowHealthKind, serverId: number) {
    try {
      await Redis.Instance.addActorFollowHealth(kind, [ serverId.toString() ])
    } catch (err) {
      logger.error('Cannot add server %d to actor follows health.', serverId, { err })
    }
  }
}
