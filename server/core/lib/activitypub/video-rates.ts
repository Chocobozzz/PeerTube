import { VideoRateType } from '@peertube/peertube-models'
import { Transaction } from 'sequelize'
import { MAccountActor, MActorUrl, MVideoAccountLight, MVideoId } from '../../types/models/index.js'
import { sendLike, sendUndoDislike, sendUndoLike } from './send/index.js'
import { sendDislike } from './send/send-dislike.js'
import { getVideoDislikeActivityPubUrlByLocalActor, getVideoLikeActivityPubUrlByLocalActor } from './url.js'
import { scheduleVideoFederation } from './videos/index.js'

async function sendVideoRateChange (
  account: MAccountActor,
  video: MVideoAccountLight,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  if (video.isLocal()) return scheduleVideoFederation({ video, transaction: t })

  return sendVideoRateChangeToOrigin(account, video, likes, dislikes, t)
}

function getLocalRateUrl (rateType: VideoRateType, actor: MActorUrl, video: MVideoId) {
  return rateType === 'like'
    ? getVideoLikeActivityPubUrlByLocalActor(actor, video)
    : getVideoDislikeActivityPubUrlByLocalActor(actor, video)
}

// ---------------------------------------------------------------------------

export {
  getLocalRateUrl,
  sendVideoRateChange
}

// ---------------------------------------------------------------------------

async function sendVideoRateChangeToOrigin (
  account: MAccountActor,
  video: MVideoAccountLight,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  // Local video, we don't need to send like
  if (video.isLocal()) return

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
