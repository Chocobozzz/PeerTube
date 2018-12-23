import { ACTOR_FOLLOW_SCORE } from '../../initializers'
import { logger } from '../../helpers/logger'

// Cache follows scores, instead of writing them too often in database
// Keep data in memory, we don't really need Redis here as we don't really care to loose some scores
class ActorFollowScoreCache {

  private static instance: ActorFollowScoreCache
  private pendingFollowsScore: { [ url: string ]: number } = {}

  private constructor () {}

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  updateActorFollowsScore (goodInboxes: string[], badInboxes: string[]) {
    if (goodInboxes.length === 0 && badInboxes.length === 0) return

    logger.info('Updating %d good actor follows and %d bad actor follows scores in cache.', goodInboxes.length, badInboxes.length)

    for (const goodInbox of goodInboxes) {
      if (this.pendingFollowsScore[goodInbox] === undefined) this.pendingFollowsScore[goodInbox] = 0

      this.pendingFollowsScore[goodInbox] += ACTOR_FOLLOW_SCORE.BONUS
    }

    for (const badInbox of badInboxes) {
      if (this.pendingFollowsScore[badInbox] === undefined) this.pendingFollowsScore[badInbox] = 0

      this.pendingFollowsScore[badInbox] += ACTOR_FOLLOW_SCORE.PENALTY
    }
  }

  getPendingFollowsScoreCopy () {
    return this.pendingFollowsScore
  }

  clearPendingFollowsScore () {
    this.pendingFollowsScore = {}
  }
}

export {
  ActorFollowScoreCache
}
