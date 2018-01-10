import { Transaction } from 'sequelize'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import {
  sendCreateDislikeToOrigin, sendCreateDislikeToVideoFollowers, sendLikeToOrigin, sendLikeToVideoFollowers, sendUndoDislikeToOrigin,
  sendUndoDislikeToVideoFollowers, sendUndoLikeToOrigin, sendUndoLikeToVideoFollowers
} from './send'

async function sendVideoRateChangeToFollowers (account: AccountModel,
                                               video: VideoModel,
                                               likes: number,
                                               dislikes: number,
                                               t: Transaction) {
  const actor = account.Actor

  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLikeToVideoFollowers(actor, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislikeToVideoFollowers(actor, video, t)

  // Like
  if (likes > 0) await sendLikeToVideoFollowers(actor, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislikeToVideoFollowers(actor, video, t)
}

async function sendVideoRateChangeToOrigin (account: AccountModel,
                                            video: VideoModel,
                                            likes: number,
                                            dislikes: number,
                                            t: Transaction) {
  const actor = account.Actor

  // Keep the order: first we undo and then we create

  // Undo Like
  if (likes < 0) await sendUndoLikeToOrigin(actor, video, t)
  // Undo Dislike
  if (dislikes < 0) await sendUndoDislikeToOrigin(actor, video, t)

  // Like
  if (likes > 0) await sendLikeToOrigin(actor, video, t)
  // Dislike
  if (dislikes > 0) await sendCreateDislikeToOrigin(actor, video, t)
}

export {
  sendVideoRateChangeToFollowers,
  sendVideoRateChangeToOrigin
}
