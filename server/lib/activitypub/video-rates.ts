import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { doJSONRequest } from '@server/helpers/requests'
import { VideoRateType } from '../../../shared/models/videos'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { CRAWL_REQUEST_CONCURRENCY } from '../../initializers/constants'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { MAccountActor, MActorUrl, MVideo, MVideoAccountLight, MVideoId } from '../../types/models'
import { getOrCreateAPActor } from './actors'
import { sendLike, sendUndoDislike, sendUndoLike } from './send'
import { sendDislike } from './send/send-dislike'
import { getVideoDislikeActivityPubUrlByLocalActor, getVideoLikeActivityPubUrlByLocalActor } from './url'

const lTags = loggerTagsFactory('ap', 'video-rate', 'create')

async function createRates (ratesUrl: string[], video: MVideo, rate: VideoRateType) {
  await Bluebird.map(ratesUrl, async rateUrl => {
    try {
      await createRate(rateUrl, video, rate)
    } catch (err) {
      logger.info('Cannot add rate %s.', rateUrl, { err, ...lTags(rateUrl, video.uuid, video.url) })
    }
  }, { concurrency: CRAWL_REQUEST_CONCURRENCY })
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

function getLocalRateUrl (rateType: VideoRateType, actor: MActorUrl, video: MVideoId) {
  return rateType === 'like'
    ? getVideoLikeActivityPubUrlByLocalActor(actor, video)
    : getVideoDislikeActivityPubUrlByLocalActor(actor, video)
}

// ---------------------------------------------------------------------------

export {
  getLocalRateUrl,
  createRates,
  sendVideoRateChange
}

// ---------------------------------------------------------------------------

async function createRate (rateUrl: string, video: MVideo, rate: VideoRateType) {
  // Fetch url
  const { body } = await doJSONRequest<any>(rateUrl, { activityPub: true })
  if (!body || !body.actor) throw new Error('Body or body actor is invalid')

  const actorUrl = getAPId(body.actor)
  if (checkUrlsSameHost(actorUrl, rateUrl) !== true) {
    throw new Error(`Rate url ${rateUrl} has not the same host than actor url ${actorUrl}`)
  }

  if (checkUrlsSameHost(body.id, rateUrl) !== true) {
    throw new Error(`Rate url ${rateUrl} host is different from the AP object id ${body.id}`)
  }

  const actor = await getOrCreateAPActor(actorUrl)

  const entry = {
    videoId: video.id,
    accountId: actor.Account.id,
    type: rate,
    url: body.id
  }

  // Video "likes"/"dislikes" will be updated by the caller
  await AccountVideoRateModel.upsert(entry)
}
