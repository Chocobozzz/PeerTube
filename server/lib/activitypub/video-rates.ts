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
import { doRequest } from '../../helpers/requests'
import { checkUrlsSameHost, getAPUrl } from '../../helpers/activitypub'
import { ActorModel } from '../../models/activitypub/actor'
import { getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from './url'

async function createRates (ratesUrl: string[], video: VideoModel, rate: VideoRateType) {
  let rateCounts = 0

  await Bluebird.map(ratesUrl, async rateUrl => {
    try {
      // Fetch url
      const { body } = await doRequest({
        uri: rateUrl,
        json: true,
        activityPub: true
      })
      if (!body || !body.actor) throw new Error('Body or body actor is invalid')

      const actorUrl = getAPUrl(body.actor)
      if (checkUrlsSameHost(actorUrl, rateUrl) !== true) {
        throw new Error(`Rate url ${rateUrl} has not the same host than actor url ${actorUrl}`)
      }

      if (checkUrlsSameHost(body.id, rateUrl) !== true) {
        throw new Error(`Rate url ${rateUrl} host is different from the AP object id ${body.id}`)
      }

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
            type: rate,
            url: body.id
          }
        })

      if (created) rateCounts += 1
    } catch (err) {
      logger.warn('Cannot add rate %s.', rateUrl, { err })
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

function getRateUrl (rateType: VideoRateType, actor: ActorModel, video: VideoModel) {
  return rateType === 'like' ? getVideoLikeActivityPubUrl(actor, video) : getVideoDislikeActivityPubUrl(actor, video)
}

export {
  getRateUrl,
  createRates,
  sendVideoRateChange
}
