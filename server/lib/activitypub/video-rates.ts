import { Transaction } from 'sequelize'
import { sendLike, sendUndoDislike, sendUndoLike } from './send'
import { VideoRateType } from '../../../shared/models/videos'
import * as Bluebird from 'bluebird'
import { getOrCreateActorAndServerAndModel } from './actor'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { logger } from '../../helpers/logger'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants'
import { doRequest } from '../../helpers/requests'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from './url'
import { sendDislike } from './send/send-dislike'
import { MAccountActor, MActorUrl, MVideo, MVideoAccountLight, MVideoId } from '../../types/models'

async function createRates (ratesUrl: string[], video: MVideo, rate: VideoRateType) {
  let rateCounts = 0

  await Bluebird.map(ratesUrl, async rateUrl => {
    try {
      // Fetch url
      const { body } = await doRequest<any>({
        uri: rateUrl,
        json: true,
        activityPub: true
      })
      if (!body || !body.actor) throw new Error('Body or body actor is invalid')

      const actorUrl = getAPId(body.actor)
      if (checkUrlsSameHost(actorUrl, rateUrl) !== true) {
        throw new Error(`Rate url ${rateUrl} has not the same host than actor url ${actorUrl}`)
      }

      if (checkUrlsSameHost(body.id, rateUrl) !== true) {
        throw new Error(`Rate url ${rateUrl} host is different from the AP object id ${body.id}`)
      }

      const actor = await getOrCreateActorAndServerAndModel(actorUrl)

      const entry = {
        videoId: video.id,
        accountId: actor.Account.id,
        type: rate,
        url: body.id
      }

      const created = await AccountVideoRateModel.upsert(entry)

      if (created) rateCounts += 1
    } catch (err) {
      logger.warn('Cannot add rate %s.', rateUrl, { err })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })

  logger.info('Adding %d %s to video %s.', rateCounts, rate, video.uuid)

  // This is "likes" and "dislikes"
  if (rateCounts !== 0) {
    const field = rate === 'like' ? 'likes' : 'dislikes'
    await video.increment(field, { by: rateCounts })
  }
}

async function sendVideoRateChange (
  account: MAccountActor,
  video: MVideoAccountLight,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  const actor = account.Actor

  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLike(actor, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislike(actor, video, t)

  // Like
  if (likes > 0) await sendLike(actor, video, t)
  // Dislike
  if (dislikes > 0) await sendDislike(actor, video, t)
}

function getRateUrl (rateType: VideoRateType, actor: MActorUrl, video: MVideoId) {
  return rateType === 'like'
    ? getVideoLikeActivityPubUrl(actor, video)
    : getVideoDislikeActivityPubUrl(actor, video)
}

export {
  getRateUrl,
  createRates,
  sendVideoRateChange
}
