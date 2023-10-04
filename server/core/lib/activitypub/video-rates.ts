import { Transaction } from 'sequelize'
import { VideoRateType } from '@peertube/peertube-models'
import { MAccountActor, MActorUrl, MVideoAccountLight, MVideoFullLight, MVideoId } from '../../types/models/index.js'
import { sendLike, sendUndoDislike, sendUndoLike } from './send/index.js'
import { sendDislike } from './send/send-dislike.js'
import { getVideoDislikeActivityPubUrlByLocalActor, getVideoLikeActivityPubUrlByLocalActor } from './url.js'
import { federateVideoIfNeeded } from './videos/index.js'

async function sendVideoRateChange (
  account: MAccountActor,
  video: MVideoFullLight,
  likes: number,
  dislikes: number,
  t: Transaction
) {
  if (video.isOwned()) return federateVideoIfNeeded(video, false, t)

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
  if (video.isOwned()) return

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
