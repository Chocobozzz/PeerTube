import { ACTOR_FOLLOW_SCORE } from '../initializers/constants.js'
import { logger } from '../helpers/logger.js'

// Cache follows scores, instead of writing them too often in database
// Keep data in memory, we don't really need Redis here as we don't really care to loose some scores
export class ActorFollowHealthCache {
  private static instance: ActorFollowHealthCache

  private pendingFollowsScore: { [url: string]: number } = {}

  private readonly pendingBadServer = new Set<number>()
  private readonly pendingGoodServer = new Set<number>()

  private readonly badInboxes = new Set<string>()
  private readonly goodInboxes = new Set<string>()

  private constructor () {}

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  updateActorFollowsHealth (goodInboxes: string[], badInboxes: string[]) {
    this.badInboxes.clear()

    if (goodInboxes.length === 0 && badInboxes.length === 0) return

    logger.info(
      'Updating %d good actor follows and %d bad actor follows.',
      goodInboxes.length,
      badInboxes.length,
      { badInboxes }
    )

    for (const goodInbox of goodInboxes) {
      if (this.pendingFollowsScore[goodInbox] === undefined) this.pendingFollowsScore[goodInbox] = 0

      this.pendingFollowsScore[goodInbox] += ACTOR_FOLLOW_SCORE.BONUS
    }

    for (const badInbox of badInboxes) {
      if (this.pendingFollowsScore[badInbox] === undefined) this.pendingFollowsScore[badInbox] = 0

      this.pendingFollowsScore[badInbox] += ACTOR_FOLLOW_SCORE.PENALTY
      this.badInboxes.add(badInbox)
    }
  }

  isBadInbox (inboxUrl: string) {
    return this.badInboxes.has(inboxUrl)
  }

  getBadInboxes () {
    return new Set(this.badInboxes)
  }

  clearBadInboxes () {
    this.badInboxes.clear()
  }

  // ---------------------------------------------------------------------------

  getGoodInboxes () {
    return new Set(this.goodInboxes)
  }

  clearGoodInboxes () {
    this.goodInboxes.clear()
  }

  // ---------------------------------------------------------------------------

  addBadServerId (serverId: number) {
    this.pendingBadServer.add(serverId)
  }

  getBadFollowingServerIds () {
    return new Set(this.pendingBadServer)
  }

  clearBadFollowingServerIds () {
    this.pendingBadServer.clear()
  }

  // ---------------------------------------------------------------------------

  addGoodServerId (serverId: number) {
    this.pendingGoodServer.add(serverId)
  }

  getGoodFollowingServerIds () {
    return new Set(this.pendingGoodServer)
  }

  clearGoodFollowingServerIds () {
    this.pendingGoodServer.clear()
  }
}
