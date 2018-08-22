import { Transaction } from 'sequelize'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { sendCreateDislike, sendLike, sendUndoDislike, sendUndoLike } from './send'
import { VideoRateType } from '../../../shared/models/videos'
import * as Bluebird from 'bluebird'
import { getOrCreateActorAndServerAndModel } from './actor'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { logger } from '../../helpers/logger'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers'

async function createRates (actorUrls: string[], video: VideoModel, rate: VideoRateType) {
  let rateCounts = 0

  await Bluebird.map(actorUrls, async actorUrl => {
    try {
      const actor = await getOrCreateActorAndServerAndModel(actorUrl)
      const [ , created ] = await AccountVideoRateModel
        .findOrCreate({
          where: {
            videoId: video.id,
            accountId: actor.Account.id
          },
          defaults: {
            videoId: video.id,
            accountId: actor.Account.id,
            type: rate
          }
        })

      if (created) rateCounts += 1
    } catch (err) {
      logger.warn('Cannot add rate %s for actor %s.', rate, actorUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  logger.info('Adding %d %s to video %s.', rateCounts, rate, video.uuid)

  // This is "likes" and "dislikes"
  if (rateCounts !== 0) await video.increment(rate + 's', { by: rateCounts })

  return
}

async function sendVideoRateChange (account: AccountModel,
                              video: VideoModel,
                              likes: number,
                              dislikes: number,
                              t: Transaction) {
  const actor = account.Actor

  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLike(actor, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislike(actor, video, t)

  // Like
  if (likes > 0) await sendLike(actor, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislike(actor, video, t)
}

export {
  createRates,
  sendVideoRateChange
}
